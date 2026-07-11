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

		it("should generate a body that calls the route handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(jit(server.app, endpoint).toString()).toContain("handler()");

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
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

			expect(endpoint.dispatch).not.toBe(staticDispatch);
			expect(endpoint.response).toBeUndefined();

			const result = await server.fetch("/b");

			expect(await result.text()).toBe("v2");
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

			expect(syncSource).toContain("content = handler();");
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
