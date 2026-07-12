import { describe, expect, it } from "bun:test";

import { Cudenix, type Plugin } from "@/core/cudenix";
import { staticDispatch } from "@/core/dispatch";
import { jit } from "@/core/jit";
import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";
import type { ValidatorPlugin } from "@/core/validator";
import { isAsync } from "@/utils/functions/is-async";

import { serveApp } from "./helpers";

const withValidator = (validate: ValidatorPlugin): Plugin =>
	function (this: Cudenix) {
		this.memory.validator = validate;
	};

const echo: ValidatorPlugin = (_schema, input) => ({
	content: input,
	success: true,
});

const jitSource = (
	module: ConstructorParameters<typeof Cudenix>[0],
): string => {
	const app = new Cudenix(module);

	app.memory.validator = echo;

	app.compile();

	return jit(app, app.methods.GET!.endpoints[0]!).toString();
};

describe("usage: jit", () => {
	describe("compilation", () => {
		it("should compile a dispatcher at compile time and keep it stable across requests", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			const compiled = endpoint.dispatch;

			expect(compiled).not.toBe(staticDispatch);

			const first = await server.fetch("/a");

			expect(endpoint.dispatch).toBe(compiled);
			expect(await first.text()).toBe("v1");

			const second = await server.fetch("/a");

			expect(endpoint.dispatch).toBe(compiled);
			expect(await second.text()).toBe("v1");
		});

		it("should directly return a sync, chainless, context-free route result", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			app.compile();

			const endpoint = app.methods.GET?.endpoints[0];

			if (endpoint === undefined) {
				throw new Error("Expected a compiled GET endpoint");
			}

			const compiled = endpoint.dispatch;
			const source = compiled.toString().replace(/\s+/g, " ");

			expect(source).toBe(
				"function (request) { return response(handler()); }",
			);
			expect(compiled.length).toBe(1);

			const first = await app.fetch(new Request("http://localhost/a"));
			const second = await app.fetch(new Request("http://localhost/a"));

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});

		it("should isolate the direct factory from an ignored validator chain", () => {
			const directSource = jitSource(
				new Module().route("GET", "/a", () => ok("v1")),
			);
			const app = new Cudenix(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/b", () => ok("v2")),
			);

			app.compile();

			const endpoint = app.methods.GET?.endpoints[0];

			if (endpoint === undefined) {
				throw new Error("Expected a compiled GET endpoint");
			}

			expect(directSource).toContain("return response(handler())");
			expect(endpoint.dispatch.toString()).toContain("let content");
		});
	});

	describe("chain semantics", () => {
		it("should run a store, validator, middleware, and route identically when jitted", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "store" }))
					.validator({ request: { body: { v: "" } } })
					.middleware(async (_, next) => {
						await next();
					})
					.route("GET", "/a", (context) =>
						ok(`${context.store.a}:${context.request.body.v}`),
					),
				{
					plugins: [
						withValidator(() => ({
							content: { v: "valid" },
							success: true,
						})),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const compiled = endpoint.dispatch;

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("store:valid");
			expect(await second.text()).toBe("store:valid");
			expect(endpoint.dispatch).toBe(compiled);
		});

		it("should short-circuit on a failing store when jitted", async () => {
			let ran = 0;

			using server = serveApp(
				new Module()
					.store(() => fail("denied", { status: 401 }))
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(first.status).toBe(401);
			expect(second.status).toBe(401);
			expect(ran).toBe(0);
		});

		it("should let a middleware short-circuit without calling next when jitted", async () => {
			let ran = 0;

			using server = serveApp(
				new Module()
					.middleware(() => ok("short"))
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("short");
			expect(await second.text()).toBe("short");
			expect(ran).toBe(0);
		});

		it("should 422 on a failing validator when jitted", async () => {
			let ran = 0;

			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
				{
					plugins: [
						withValidator(() => ({
							content: [{ message: "bad" }],
							success: false,
						})),
					],
				},
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(first.status).toBe(422);
			expect(second.status).toBe(422);
			expect(await second.json()).toEqual({ body: [{ message: "bad" }] });
			expect(ran).toBe(0);
		});

		it("should preserve nested middleware order when jitted", async () => {
			const order: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						order.push("m1-before");

						await next();

						order.push("m1-after");
					})
					.middleware(async (_, next) => {
						order.push("m2-before");

						await next();

						order.push("m2-after");
					})
					.route("GET", "/a", () => {
						order.push("route");

						return ok("v1");
					}),
			);

			await server.fetch("/a");

			order.length = 0;

			await server.fetch("/a");

			expect(order).toEqual([
				"m1-before",
				"m2-before",
				"route",
				"m2-after",
				"m1-after",
			]);
		});

		it("should validate every key of a multi-slot validator when jitted", async () => {
			using server = serveApp(
				new Module()
					.validator({
						request: { body: { v: "" }, query: { v: "" } },
					})
					.route("GET", "/a", (context) =>
						ok(
							`${context.request.body.v}:${context.request.query.v}`,
						),
					),
				{
					plugins: [
						withValidator((_schema, _input, slot) => ({
							content: { v: slot },
							success: true,
						})),
					],
				},
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("body:query");
			expect(await second.text()).toBe("body:query");
		});
	});

	describe("static fast path", () => {
		it("should serve a static, chainless route from a precomputed clone", async () => {
			using server = serveApp(new Module().route("GET", "/b", ok("v2")));

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(endpoint.dispatch).toBe(staticDispatch);
			expect(endpoint.response).toBeInstanceOf(Response);

			const native = await server.fetch("/b");

			const inProcess = await server.app.fetch(
				new Request(server.url("/b")),
			);
			const again = await server.app.fetch(new Request(server.url("/b")));

			expect(await native.text()).toBe("v2");
			expect(await inProcess.text()).toBe("v2");
			expect(await again.text()).toBe("v2");
			expect(endpoint.dispatch).toBe(staticDispatch);
		});

		it("should serve a static wildcard route through staticDispatch", async () => {
			using server = serveApp(
				new Module().route("GET", "/b/...rest", ok("v2")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(endpoint.dispatch).toBe(staticDispatch);

			const first = await server.fetch("/b/x/y");
			const second = await server.fetch("/b/x/y");

			expect(await first.text()).toBe("v2");
			expect(await second.text()).toBe("v2");
		});

		it("should not use staticDispatch when a static route has chain links", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();
					})
					.route("GET", "/b", ok("v2")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const source = endpoint.dispatch.toString();

			expect(endpoint.dispatch).not.toBe(staticDispatch);
			expect(endpoint.response).toBeUndefined();
			expect(source).not.toContain("new Context");
			expect(source).toContain(
				"await chain[0].handler(undefined, next_0)",
			);

			const result = await server.fetch("/b");

			expect(await result.text()).toBe("v2");
		});
	});

	describe("unused context fast path", () => {
		it("should omit Context when a middleware only uses next", () => {
			const source = jitSource(
				new Module()
					.middleware(async (_context, next) => {
						await next();
					})
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).not.toContain("new Context");
			expect(source).toContain(
				"await chain[0].handler(undefined, next_0)",
			);
			expect(source).toContain("content = handler()");
		});

		it("should omit Context and params parsing when a route ignores its parameter", () => {
			const source = jitSource(
				new Module().route("GET", "/a/:id", (_context) => ok("v1")),
			);

			expect(source).not.toContain("new Context");
			expect(source).not.toContain("decodePathParam");
			expect(source).not.toContain('"cookies" in request');
			expect(source).toContain("return response(handler())");
		});

		it("should pass undefined to a store that ignores its context parameter", () => {
			const source = jitSource(
				new Module()
					.store((_context) => ({ a: "v1" }))
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).not.toContain("new Context");
			expect(source).toContain("chain[0].handler(undefined)");
			expect(source).toContain("content = handler()");
		});
	});

	describe("async-aware codegen", () => {
		it("should await an async route handler and emit a bare call for a plain one", async () => {
			using asyncServer = serveApp(
				new Module().route("GET", "/a", async () => ok("v1")),
			);

			using syncServer = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const asyncEndpoint = asyncServer.app.methods.GET!.endpoints[0]!;
			const syncEndpoint = syncServer.app.methods.GET!.endpoints[0]!;

			const asyncSource = jit(asyncServer.app, asyncEndpoint).toString();

			expect(asyncSource).toContain("await handler()");
			expect(asyncSource.startsWith("async")).toBe(true);

			const syncSource = jit(syncServer.app, syncEndpoint).toString();

			expect(syncSource).toContain("return response(handler());");
			expect(syncSource).not.toContain("await");
			expect(syncSource).not.toContain("then");
			expect(syncSource.startsWith("async")).toBe(false);
		});

		it("should await a store and middleware from their declared async signature", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();
					})
					.store(async () => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const source = jit(server.app, endpoint).toString();

			expect(source).toContain("await chain[0].handler(context, next_0)");
			expect(source).toContain("await chain[1].handler(context)");

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});

		it("should compile a fully synchronous chain to a synchronous dispatcher", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const compiled = endpoint.dispatch;

			const first = await server.fetch("/a");

			expect(endpoint.dispatch).toBe(compiled);
			expect(isAsync(endpoint.dispatch)).toBe(false);

			const source = jit(server.app, endpoint).toString();

			expect(source.startsWith("async")).toBe(false);
			expect(source).not.toContain("await");

			const second = await server.fetch("/a");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});

		it("should serve a synchronous endpoint synchronously from the very first request", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const first = server.app.fetch(new Request(server.url("/a")));

			expect(first).toBeInstanceOf(Response);
			expect(await (first as Response).text()).toBe("v1");

			const second = server.app.fetch(new Request(server.url("/a")));

			expect(second).toBeInstanceOf(Response);
			expect(await (second as Response).text()).toBe("v1");
		});

		it("should keep the dispatcher async when any handler awaits", async () => {
			using server = serveApp(
				new Module()
					.store(async () => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(isAsync(endpoint.dispatch)).toBe(true);

			const second = await server.fetch("/a");

			expect(await second.text()).toBe("v1");
		});

		it("should keep a plain gating middleware synchronous and correct in both branches", async () => {
			using server = serveApp(
				new Module()
					.middleware((context, next) =>
						context.request.raw.headers.get("authorization")
							? next()
							: fail("denied", { status: 401 }),
					)
					.route("GET", "/a", () => ok("v1")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			const denied = await server.fetch("/a");

			expect(isAsync(endpoint.dispatch)).toBe(false);

			const allowed = await server.fetch("/a", {
				headers: { authorization: "token" },
			});
			const deniedAgain = await server.fetch("/a");

			expect(denied.status).toBe(401);
			expect(allowed.status).toBe(200);
			expect(await allowed.text()).toBe("v1");
			expect(deniedAgain.status).toBe(401);
		});

		it("should await a bound async route handler whose source text is not 'async'", async () => {
			const handler = (async () => ok("v1")).bind(null);

			using server = serveApp(new Module().route("GET", "/a", handler));

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(isAsync(endpoint.dispatch)).toBe(true);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should short-circuit on a failing bound async store", async () => {
			let ran = 0;

			const store = (async () => fail("denied", { status: 401 })).bind(
				null,
			);

			using server = serveApp(
				new Module().store(store).route("GET", "/a", () => {
					ran++;

					return ok("v1");
				}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(first.status).toBe(401);
			expect(second.status).toBe(401);
			expect(ran).toBe(0);
		});

		it("should run a sync validator plugin when jitted", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", (context) =>
						ok(context.request.body.v),
					),
				{
					plugins: [
						withValidator((_schema, _input, slot) => ({
							content: { v: `sync-${slot}` },
							success: true,
						})),
					],
				},
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("sync-body");
			expect(await second.text()).toBe("sync-body");
		});

		it("should run an async validator plugin when jitted", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", (context) =>
						ok(context.request.body.v),
					),
				{
					plugins: [
						withValidator(async (_schema, _input, slot) => ({
							content: { v: `async-${slot}` },
							success: true,
						})),
					],
				},
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("async-body");
			expect(await second.text()).toBe("async-body");
		});
	});

	describe("validator-only fast path", () => {
		it("should validate without allocating Context when no user handler consumes it", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).toContain("validatedRequest");
			expect(source).not.toContain("new Context");
			expect(source).toContain("handler()");
		});

		it("should keep local and full-context validator factories separate", () => {
			const local = jitSource(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);
			const full = jitSource(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", (context) => ok(context.request.query)),
			);

			expect(local).toContain("validatedRequest");
			expect(local).not.toContain("new Context");
			expect(full).toContain("new Context");
			expect(full).not.toContain("validatedRequest");
		});

		it("should omit Bun request detection when an endpoint has no params", () => {
			const source = jitSource(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			expect(source).toContain("new Context");
			expect(source).not.toContain('"cookies" in request');
		});

		it("should parse lean params only after preceding stores succeed", () => {
			const source = jitSource(
				new Module()
					.store(() => ({ a: "v1" }))
					.validator({ request: { params: {} } })
					.route("GET", "/a/:id", () => ok("v1")),
			);

			expect(
				source.indexOf("chain[0].handler(undefined)"),
			).toBeGreaterThan(-1);
			expect(
				source.indexOf('const isBun = "cookies" in request'),
			).toBeGreaterThan(source.indexOf("chain[0].handler(undefined)"));
		});

		it("should pass a transformed slot from one validator to the next", async () => {
			const inputs: unknown[] = [];
			let calls = 0;
			const validate: ValidatorPlugin = (_schema, input) => {
				inputs.push(input);
				calls++;

				return { content: { step: calls }, success: true };
			};

			const app = new Cudenix(
				new Module()
					.validator({ request: { query: {} } })
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			app.memory.validator = validate;
			app.compile();

			const result = await app.fetch(
				new Request("http://localhost/a?value=first"),
			);

			expect(await result.text()).toBe("v1");
			expect(inputs).toEqual([{ value: "first" }, { step: 1 }]);
		});

		it("should keep an async validator and its 422 short-circuit semantics", async () => {
			let ran = 0;

			const app = new Cudenix(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
			);

			app.memory.validator = async () => ({
				content: ["bad"],
				success: false,
			});

			app.compile();

			const pending = app.fetch(new Request("http://localhost/a?v=1"));

			expect(pending).toBeInstanceOf(Promise);

			const result = await pending;

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({ query: ["bad"] });
			expect(ran).toBe(0);
		});

		it("should parse an asynchronous body slot without constructing Context", async () => {
			let input: unknown;
			const validate: ValidatorPlugin = (_schema, value) => {
				input = value;

				return { content: value, success: true };
			};
			const app = new Cudenix(
				new Module()
					.validator({ request: { body: {} } })
					.route("POST", "/a", () => ok("v1")),
			);

			app.memory.validator = validate;
			app.compile();

			const endpoint = app.methods.POST!.endpoints[0]!;
			const pending = app.fetch(
				new Request("http://localhost/a", {
					body: JSON.stringify({ value: "body" }),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
			);

			expect(endpoint.dispatch.toString()).not.toContain("new Context");
			expect(pending).toBeInstanceOf(Promise);
			expect(await (await pending).text()).toBe("v1");
			expect(input).toEqual({ value: "body" });
		});

		it("should parse cookies and headers into lean validation state", async () => {
			const inputs = new Map<string, unknown>();
			const validate: ValidatorPlugin = (_schema, input, slot) => {
				inputs.set(slot, input);

				return { content: input, success: true };
			};
			const app = new Cudenix(
				new Module()
					.validator({ request: { cookies: {}, headers: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			app.memory.validator = validate;
			app.compile();

			const result = await app.fetch(
				new Request("http://localhost/a", {
					headers: { cookie: "a=v1; b=v2", "x-test": "yes" },
				}),
			);

			expect(await result.text()).toBe("v1");
			expect(inputs.get("cookies")).toEqual({ a: "v1", b: "v2" });
			expect(inputs.get("headers")).toMatchObject({
				cookie: "a=v1; b=v2",
				"x-test": "yes",
			});
		});

		it("should stream SSE after validation without retaining a full Context", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/events", function* () {
						yield { data: ok("v1") };
					}),
				{ plugins: [withValidator(echo)] },
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const source = endpoint.dispatch.toString();
			const result = await server.fetch("/events?v=1");

			expect(source).toContain("const server = app.server");
			expect(source).not.toContain("new Context");
			expect(await result.text()).toBe('data: "v1"\n\n');
		});

		it("should parse params identically through native and regexp dispatch", async () => {
			const inputs: unknown[] = [];

			using server = serveApp(
				new Module()
					.validator({ request: { params: {} } })
					.route("GET", "/users/:id", () => ok("v1")),
				{
					plugins: [
						withValidator((_schema, input) => {
							inputs.push(input);

							return { content: input, success: true };
						}),
					],
				},
			);

			const native = await server.fetch("/users/42");
			const fallback = await server.app.fetch(
				new Request(server.url("/users/42")),
			);

			expect(await native.text()).toBe("v1");
			expect(await fallback.text()).toBe("v1");
			expect(inputs).toEqual([{ id: "42" }, { id: "42" }]);
		});

		it("should preserve store merge side effects without exposing the store", async () => {
			let reads = 0;
			const value = {} as Record<string, unknown>;

			Object.defineProperty(value, "observed", {
				enumerable: true,
				get() {
					reads++;

					return true;
				},
			});

			const app = new Cudenix(
				new Module()
					.store(() => value)
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			app.memory.validator = echo;
			app.compile();

			const result = await app.fetch(
				new Request("http://localhost/a?v=1"),
			);

			expect(await result.text()).toBe("v1");
			expect(reads).toBe(1);
		});

		it("should keep a store failure ahead of validation as a short circuit", async () => {
			let validated = 0;
			let ran = 0;

			const app = new Cudenix(
				new Module()
					.store(() => fail("denied", { status: 401 }))
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
			);

			app.memory.validator = () => {
				validated++;

				return { content: {}, success: true };
			};

			app.compile();

			const result = await app.fetch(
				new Request("http://localhost/a?v=1"),
			);

			expect(result.status).toBe(401);
			expect(validated).toBe(0);
			expect(ran).toBe(0);
		});
	});

	describe("request slot parsing", () => {
		it("should emit a parse call only for the slot a validator declares", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { body: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).toContain("parseBody");
			expect(source).not.toContain("parseQuery");
			expect(source).not.toContain("parseParams");
			expect(source).not.toContain("parseCookies");
		});

		it("should emit no parse call when the chain has no validator", () => {
			const source = jitSource(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			expect(source).not.toContain("parseBody");
			expect(source).not.toContain("parseQuery");
			expect(source).not.toContain("parseParams");
			expect(source).not.toContain("parseCookies");
		});

		it("should emit parseQuery for a query validator", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).toContain("parseQuery");
		});

		it("should emit the endpoint-specific params decoder for a params validator", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { params: {} } })
					.route("GET", "/a/:p1", () => ok("v1")),
			);

			expect(source).toContain("decodePathParam");
		});

		it("should emit parseCookies for a cookies validator", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { cookies: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).toContain("parseCookies");
		});

		it("should read raw headers for a headers validator", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { headers: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).toContain("headers.toJSON()");
		});

		it("should parse each slot at most once across multiple validators", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { body: {} } })
					.validator({ request: { body: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect((source.match(/parseBody/g) ?? []).length).toBe(1);
		});

		it("should parse the body and hand it to the validator", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: {} } })
					.route("POST", "/a", (context) => ok(context.request.body)),
				{ plugins: [withValidator(echo)] },
			);

			const result = await server.fetch("/a", {
				body: JSON.stringify({ v: "hi" }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});

			expect(await result.json()).toEqual({ v: "hi" });
		});

		it("should parse the query and hand it to the validator", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", (context) => ok(context.request.query)),
				{ plugins: [withValidator(echo)] },
			);

			const result = await server.fetch("/a?v=hi&n=2");

			expect(await result.json()).toEqual({ n: "2", v: "hi" });
		});

		it("should resolve params from a Bun-native route and hand them to the validator", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { params: {} } })
					.route("GET", "/a/:p1", (context) =>
						ok(context.request.params),
					),
				{ plugins: [withValidator(echo)] },
			);

			const result = await server.fetch("/a/1");

			expect(await result.json()).toEqual({ p1: "1" });
		});

		it("should resolve params through the regexp fallback and hand them to the validator", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { params: {} } })
					.route("GET", "/a/:p1", (context) =>
						ok(context.request.params),
					),
				{ plugins: [withValidator(echo)] },
			);

			const result = await server.app.fetch(
				new Request(server.url("/a/1")),
			);

			expect(await result.json()).toEqual({ p1: "1" });
		});

		it("should not parse a slot no validator declares", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: {} } })
					.route("GET", "/a", (context) =>
						ok(
							typeof (context.request as Record<string, unknown>)
								.query,
						),
					),
				{ plugins: [withValidator(echo)] },
			);

			const result = await server.fetch("/a?v=hi");

			expect(await result.text()).toBe("undefined");
		});
	});
});
