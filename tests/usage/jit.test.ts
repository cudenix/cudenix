import { describe, expect, it } from "bun:test";

import type { AnyContext } from "@/core/context";
import { Cudenix, type Plugin } from "@/core/cudenix";
import { inspectJitFactoryDependencies, jit } from "@/core/jit";
import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";
import type { ValidatorCompiler, ValidatorPlugin } from "@/core/validator";
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

const asyncEcho: ValidatorPlugin = async (_schema, input) => ({
	content: input,
	success: true,
});

const compileEcho: ValidatorCompiler = () => ({
	run: (input) => ({ content: input, success: true }),
	sync: true,
});

const compactSource = (source: string): string => source.replace(/\s+/g, "");

const expectNoContextAllocation = (source: string) => {
	expect(compactSource(source)).not.toContain("constcontext=newEmpty()");
};

const expectNoDynamicPromiseAdoption = (source: string) => {
	const compact = compactSource(source);

	expect(compact).not.toContain("settle(");
	expect(compact).not.toContain("instanceofPromise");
	expect(compact).not.toContain(".then(");
};

const jitSource = (
	module: ConstructorParameters<typeof Cudenix>[0],
): string => {
	const app = new Cudenix(module);

	app.memory.validator = echo;

	app.compile();

	return jit(app, app.methods.GET!.endpoints[0]!).toString();
};

const jitDependencies = (
	module: ConstructorParameters<typeof Cudenix>[0],
	validator?: ValidatorPlugin,
) => {
	const app = new Cudenix(module);

	if (validator) {
		app.memory.validator = validator;
	}

	app.compile();

	return inspectJitFactoryDependencies(app, app.methods.GET!.endpoints[0]!);
};

describe("usage: jit", () => {
	describe("compilation", () => {
		it("should link only the dependencies emitted by each factory shape", () => {
			expect(
				jitDependencies(
					new Module().route("GET", "/direct", () => ok("v1")),
				),
			).toEqual(["response", "handler"]);
			expect(
				jitDependencies(
					new Module().route("GET", "/context", (context) =>
						ok(context.memory),
					),
				),
			).toEqual(["Empty", "app", "response", "handler"]);
			expect(
				jitDependencies(
					new Module().route("GET", "/metadata", (context) => {
						context.response.headers.set("x-value", "v1");

						return ok("v1");
					}),
				),
			).toEqual(["Empty", "Headers", "response", "handler"]);
			expect(
				jitDependencies(
					new Module()
						.store(() => ({ ignored: true }))
						.route("GET", "/store", () => ok("v1")),
				),
			).toEqual(["response", "chain", "Reply", "handler"]);
			expect(
				jitDependencies(
					new Module()
						.store(() => ({ value: "v1" }))
						.route("GET", "/stored-context", (context) =>
							ok(context.store.value),
						),
				),
			).toEqual([
				"Empty",
				"response",
				"chain",
				"merge",
				"Reply",
				"handler",
			]);
			expect(
				jitDependencies(
					new Module()
						.validator({ request: { query: {} } })
						.route("GET", "/query", () => ok("v1")),
					echo,
				),
			).toEqual([
				"response",
				"parseQuery",
				"validator",
				"Empty",
				"fail",
				"chain",
				"handler",
			]);
			expect(
				jitDependencies(
					new Module()
						.validator({
							request: { body: {}, cookies: {}, headers: {} },
						})
						.route("GET", "/request", () => ok("v1")),
					echo,
				),
			).toEqual([
				"response",
				"parseBody",
				"validator",
				"Empty",
				"parseCookies",
				"fail",
				"chain",
				"handler",
			]);
			expect(
				jitDependencies(
					new Module()
						.validator({ request: { params: {} } })
						.route("GET", "/params/:id", () => ok("v1")),
					echo,
				),
			).toEqual([
				"response",
				"Empty",
				"decodePathParam",
				"validator",
				"fail",
				"chain",
				"handler",
			]);
			expect(
				jitDependencies(
					new Module().route("GET", "/sse", function* () {
						yield { data: ok("v1") };
					}),
				),
			).toEqual(["response", "handler", "app", "stream"]);
		});

		it("should isolate every top-level context shape in the factory cache", () => {
			const assignments = {
				memory: "context.memory=app.memory",
				request: "context.request=newEmpty()",
				server: "context.server=app.server",
				store: "context.store=newEmpty()",
			} as const;
			const expectOnly = (
				source: string,
				expected: keyof typeof assignments,
			) => {
				const compact = compactSource(source);

				expect(compact).toContain("constcontext=newEmpty()");

				for (const [name, assignment] of Object.entries(assignments)) {
					expect(compact.includes(assignment)).toBe(
						name === expected,
					);
				}
			};
			const syncSources = {
				memory: jitSource(
					new Module().route("GET", "/memory", (context) =>
						ok(context.memory),
					),
				),
				request: jitSource(
					new Module().route("GET", "/request", (context) =>
						ok(context.request.raw.method),
					),
				),
				server: jitSource(
					new Module().route("GET", "/server", (context) =>
						ok(context.server),
					),
				),
				store: jitSource(
					new Module().route("GET", "/store", (context) =>
						ok(context.store),
					),
				),
			};
			const asyncSources = {
				memory: jitSource(
					new Module().route("GET", "/memory", async (context) =>
						ok(context.memory),
					),
				),
				request: jitSource(
					new Module().route("GET", "/request", async (context) =>
						ok(context.request.raw.method),
					),
				),
				server: jitSource(
					new Module().route("GET", "/server", async (context) =>
						ok(context.server),
					),
				),
				store: jitSource(
					new Module().route("GET", "/store", async (context) =>
						ok(context.store),
					),
				),
			};

			for (const [name, source] of Object.entries(syncSources)) {
				expectOnly(source, name as keyof typeof assignments);
			}

			for (const [name, source] of Object.entries(asyncSources)) {
				expectOnly(source, name as keyof typeof assignments);
			}
		});

		it("should bind endpoint values when reusing a factory shape", async () => {
			const first = new Cudenix(
				new Module()
					.store(() => ({ value: "first" }))
					.route("GET", "/a", (context) => ok(context.store.value)),
			);
			const second = new Cudenix(
				new Module()
					.store(() => ({ value: "second" }))
					.route("GET", "/b", (context) => ok(context.store.value)),
			);

			first.compile();
			second.compile();

			const firstResponse = await first.fetch(
				new Request("http://localhost/a"),
			);
			const secondResponse = await second.fetch(
				new Request("http://localhost/b"),
			);

			expect(await firstResponse.text()).toBe("first");
			expect(await secondResponse.text()).toBe("second");
		});

		it("should compile a dispatcher at compile time and keep it stable across requests", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			const compiled = endpoint.dispatch;

			expect(endpoint.response).toBeUndefined();

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
			const source = compiled.toString();

			expect(source).not.toContain("\n");
			expect(compactSource(source)).toContain("function(){");
			expect(compactSource(source)).toContain(
				"returnresponse(handler())",
			);
			expect(source).not.toContain("Promise");
			expect(source).not.toContain(".then(");
			expect(compiled.length).toBe(0);

			const first = await app.fetch(new Request("http://localhost/a"));
			const second = await app.fetch(new Request("http://localhost/a"));

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});

		it("should directly return an async, chainless, context-free route result", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", async () => ok("v1")),
			);

			app.compile();

			const endpoint = app.methods.GET?.endpoints[0];

			if (endpoint === undefined) {
				throw new Error("Expected a compiled GET endpoint");
			}

			const compiled = endpoint.dispatch;
			const source = compiled.toString();

			expect(source).not.toContain("\n");
			expect(compactSource(source)).toContain("asyncfunction(){");
			expect(compactSource(source)).toContain("awaithandler()");
			expect(compactSource(source)).toContain("response(");
			expect(compiled.length).toBe(0);

			const result = await app.fetch(new Request("http://localhost/a"));

			expect(await result.text()).toBe("v1");
		});

		it("should collapse an ignored validator chain into a direct dispatcher", async () => {
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

			expect(compactSource(directSource)).toContain("handler()");
			expect(endpoint.dispatch.length).toBe(0);
			expect(endpoint.dispatch.toString()).not.toContain("let content");

			const result = app.fetch(new Request("http://localhost/b"));

			expect(result).toBeInstanceOf(Response);
			expect(await (result as Response).text()).toBe("v2");
		});

		it("should collapse empty validators even when a plugin is installed", async () => {
			let calls = 0;
			const validate: ValidatorPlugin = (_schema, input) => {
				calls++;

				return { content: input, success: true };
			};
			const app = new Cudenix(
				new Module()
					.validator({ request: {} })
					.validator({ request: {} })
					.route("GET", "/a", () => ok("v1")),
			);

			app.memory.validator = validate;
			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const result = app.fetch(new Request("http://localhost/a"));

			expect(endpoint.dispatch.length).toBe(0);
			expect(endpoint.dispatch.toString()).not.toContain("validator");
			expect(result).toBeInstanceOf(Response);
			expect(await (result as Response).text()).toBe("v1");
			expect(calls).toBe(0);
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

			const dispatch = endpoint.dispatch;

			expect(endpoint.response).toBeInstanceOf(Response);
			expect(isAsync(dispatch)).toBe(false);

			const native = await server.fetch("/b");

			const inProcess = await server.app.fetch(
				new Request(server.url("/b")),
			);
			const again = await server.app.fetch(new Request(server.url("/b")));

			expect(await native.text()).toBe("v2");
			expect(await inProcess.text()).toBe("v2");
			expect(await again.text()).toBe("v2");
			expect(endpoint.dispatch).toBe(dispatch);
		});

		it("should give each static endpoint its own clone dispatcher", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/b", ok("v2"))
					.route("GET", "/c", ok("v3")),
			);

			const first = server.app.methods.GET!.endpoints[0]!;
			const second = server.app.methods.GET!.endpoints[1]!;

			expect(first.dispatch).not.toBe(second.dispatch);
			expect(first.dispatch(new Request(server.url("/b")))).not.toBe(
				first.response,
			);
			expect(await (await server.fetch("/b")).text()).toBe("v2");
			expect(await (await server.fetch("/c")).text()).toBe("v3");
		});

		it("should serve a static wildcard route through the static fast path", async () => {
			using server = serveApp(
				new Module().route("GET", "/b/...rest", ok("v2")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(endpoint.response).toBeInstanceOf(Response);

			const first = await server.fetch("/b/x/y");
			const second = await server.fetch("/b/x/y");

			expect(await first.text()).toBe("v2");
			expect(await second.text()).toBe("v2");
		});

		it("should not use the static fast path when a static route has chain links", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();
					})
					.route("GET", "/b", ok("v2")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const source = endpoint.dispatch.toString();

			expect(endpoint.response).toBeUndefined();
			expectNoContextAllocation(source);
			expect(compactSource(source)).toContain(
				"awaitchain[0].handler(undefined,next_0)",
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

			expectNoContextAllocation(source);
			expect(compactSource(source)).toContain(
				"awaitchain[0].handler(undefined,next_0)",
			);
			expect(compactSource(source)).toContain("content=handler()");
		});

		it("should omit Context and params parsing when a route ignores its parameter", () => {
			const source = jitSource(
				new Module().route("GET", "/a/:id", (_context) => ok("v1")),
			);

			expectNoContextAllocation(source);
			expect(source).not.toContain("decodePathParam");
			expect(source).not.toContain("request.params");
			expect(compactSource(source)).toContain(
				"returnresponse(handler())",
			);
		});

		it("should pass undefined to a store that ignores its context parameter", () => {
			const source = jitSource(
				new Module()
					.store((_context) => ({ a: "v1" }))
					.route("GET", "/a/:id", () => ok("v1")),
			);

			expectNoContextAllocation(source);
			expect(compactSource(source)).toContain("function(request){");
			expect(source).not.toContain("match");
			expect(source).toContain("chain[0].handler(undefined)");
			expect(compactSource(source)).toContain("content=handler()");
		});
	});

	describe("response metadata specialization", () => {
		it("should omit cookies and headers when handlers only use independent context fields", () => {
			const source = jitSource(
				new Module().route("GET", "/a", (context) =>
					ok(
						`${context.request.raw.method}:${String(context.memory)}`,
					),
				),
			);
			const compact = compactSource(source);

			expect(compact).toContain("constcontext=newEmpty()");
			expect(compact).toContain("context.memory=app.memory");
			expect(compact).toContain("context.request=newEmpty()");
			expect(compact).toContain("returnresponse(content)");
			expect(compact).not.toContain("context.response.content");
			expect(compact).not.toContain("context.response.cookies");
			expect(compact).not.toContain("context.response.headers");
		});

		it("should allocate only headers when a handler accesses headers", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set("x-value", "v1");

					return ok("v1");
				}),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = endpoint.dispatch.toString();
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(compactSource(source)).toContain("constcontext=newEmpty()");
			expect(compactSource(source)).toContain(
				"context.response=newEmpty()",
			);
			expect(source).toContain("new Headers");
			expect(source).not.toContain("CookieMap");
			expect(compactSource(source)).toContain(
				"response(content,undefined,context.response.headers)",
			);
			expect(result.headers.get("x-value")).toBe("v1");
		});

		it("should allocate only cookies when a handler accesses cookies", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", (context) => {
					const incoming = context.response.cookies.get("incoming");

					context.response.cookies.set(
						"outgoing",
						incoming ?? "none",
					);

					return ok(incoming);
				}),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = endpoint.dispatch.toString();
			const result = await app.fetch(
				new Request("http://localhost/a", {
					headers: { cookie: "incoming=v1" },
				}),
			);

			expect(compactSource(source)).toContain("constcontext=newEmpty()");
			expect(compactSource(source)).toContain(
				"context.response=newEmpty()",
			);
			expect(source).toContain("new CookieMap");
			expect(source).not.toContain("new Headers");
			expect(compactSource(source)).toContain(
				"response(content,context.response.cookies)",
			);
			expect(await result.text()).toBe("v1");
			expect(result.headers.get("set-cookie")).toStartWith("outgoing=v1");
		});

		it("should combine content and cookies without allocating headers", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", (context) => {
					context.response.cookies.set("outgoing", "v1");
					context.response.content = ok("staged");

					return context.response.content;
				}),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = compactSource(endpoint.dispatch.toString());
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(source).toContain("constcontext=newEmpty()");
			expect(source).toContain("newCookieMap");
			expect(source).not.toContain("newHeaders");
			expect(source).toContain(
				"response(context.response.content,context.response.cookies)",
			);
			expect(await result.text()).toBe("staged");
			expect(result.headers.get("set-cookie")).toStartWith("outgoing=v1");
		});

		it("should combine cookies and headers while keeping content local", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", (context) => {
					context.response.cookies.set("outgoing", "v1");
					context.response.headers.set("x-value", "v1");

					return ok("local-content");
				}),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = compactSource(endpoint.dispatch.toString());
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(source).toContain("constcontext=newEmpty()");
			expect(source).toContain("newCookieMap");
			expect(source).toContain("newHeaders");
			expect(source).toContain(
				"response(content,context.response.cookies,context.response.headers)",
			);
			expect(await result.text()).toBe("local-content");
			expect(result.headers.get("x-value")).toBe("v1");
			expect(result.headers.get("set-cookie")).toStartWith("outgoing=v1");
		});

		it("should keep content on context without allocating cookies or headers", async () => {
			const app = new Cudenix(
				new Module()
					.middleware((context) => {
						context.response.content = ok("from-middleware");
					})
					.route("GET", "/a", () => ok("unreachable")),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = endpoint.dispatch.toString();
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(compactSource(source)).toContain("constcontext=newEmpty()");
			expect(source).not.toContain("CookieMap");
			expect(source).not.toContain("new Headers");
			expect(compactSource(source)).toContain(
				"response(context.response.content)",
			);
			expect(await result.text()).toBe("from-middleware");
		});

		it("should union metadata used by different links around next", async () => {
			const app = new Cudenix(
				new Module()
					.middleware((context, next) => {
						next();
						context.response.content = ok("overridden");
					})
					.route("GET", "/a", (context) => {
						context.response.headers.set("x-value", "v1");

						return ok("route");
					}),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = compactSource(endpoint.dispatch.toString());
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(source).toContain("constcontext=newEmpty()");
			expect(source).not.toContain("CookieMap");
			expect(source).toContain(
				"response(context.response.content,undefined,context.response.headers)",
			);
			expect(await result.text()).toBe("overridden");
			expect(result.headers.get("x-value")).toBe("v1");
		});

		it("should retain request state when a metadata route has path params", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a/:id", (context) => {
					context.response.headers.set("x-value", "v1");

					return ok("v1");
				}),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = compactSource(endpoint.dispatch.toString());
			const result = await app.fetch(
				new Request("http://localhost/a/42"),
			);

			expect(source).toContain("context.request=newEmpty()");
			expect(source).toContain("context.response=newEmpty()");
			expect(source).toContain("context.request.params=params");
			expect(await result.text()).toBe("v1");
			expect(result.headers.get("x-value")).toBe("v1");
		});

		it("should honor a handler's toString override when selecting metadata", async () => {
			const handler = (context: AnyContext) => {
				const responseState = context.response;

				responseState.headers.set("x-value", "v1");

				return ok("v1");
			};

			handler.toString = () => "context => context.response.headers";

			const app = new Cudenix(new Module().route("GET", "/a", handler));

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(compactSource(endpoint.dispatch.toString())).toContain(
				"constcontext=newEmpty()",
			);
			expect(endpoint.dispatch.toString()).toContain("new Headers");
			expect(endpoint.dispatch.toString()).not.toContain("CookieMap");
			expect(result.headers.get("x-value")).toBe("v1");
		});

		it("should fail closed for aliasing, destructuring, and computed access", () => {
			const dynamicKey = Date.now() > 0 ? "request" : "response";
			const identity = <Value>(value: Value) => value;
			const aliased = jitSource(
				new Module().route("GET", "/a", (context) =>
					ok(identity(context).request.raw.method),
				),
			);
			const destructured = jitSource(
				new Module().route("GET", "/a", ({ request }) =>
					ok(request.raw.method),
				),
			);
			const computed = jitSource(
				new Module().route("GET", "/a", (context) =>
					ok(
						(context as unknown as Record<string, unknown>)[
							dynamicKey
						],
					),
				),
			);

			for (const source of [aliased, destructured, computed]) {
				const compact = compactSource(source);

				expect(compact).toContain("context.memory=app.memory");
				expect(compact).toContain("context.request=newEmpty()");
				expect(compact).toContain("context.response=newEmpty()");
				expect(compact).toContain("context.server=app.server");
				expect(compact).toContain("context.store=newEmpty()");
			}
		});

		it("should materialize every context field for opaque calls", async () => {
			let app: Cudenix;
			const inspect = (context: AnyContext) => {
				context.response.headers.set("x-value", "v1");
				context.response.cookies.set("outgoing", "v1");

				return ok(
					String(
						context.memory === app.memory &&
							context.request.raw.method === "GET" &&
							context.server === app.server &&
							Object.keys(context).join(",") ===
								"memory,request,response,server,store",
					),
				);
			};

			app = new Cudenix(
				new Module().route("GET", "/a", (context) => inspect(context)),
			);
			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const result = await app.fetch(new Request("http://localhost/a"));

			expect(compactSource(endpoint.dispatch.toString())).toContain(
				"constcontext=newEmpty()",
			);
			expect(await result.text()).toBe("true");
			expect(result.headers.get("x-value")).toBe("v1");
			expect(result.headers.get("set-cookie")).toStartWith("outgoing=v1");
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

			expect(compactSource(asyncSource)).toContain(
				"response(awaithandler())",
			);
			expect(asyncSource.startsWith("async")).toBe(true);

			const syncSource = jit(syncServer.app, syncEndpoint).toString();

			expect(compactSource(syncSource)).toContain(
				"returnresponse(handler())",
			);
			expect(syncSource).not.toContain("await");
			expect(syncSource).not.toContain("Promise");
			expect(syncSource).not.toContain(".then(");
			expect(syncSource.startsWith("async")).toBe(false);
		});

		it("should not adopt a Promise returned by a route without an async declaration", () => {
			const handler = () => Promise.resolve(ok("unsupported"));
			const app = new Cudenix(new Module().route("GET", "/a", handler));

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = jit(app, endpoint).toString();

			expect(isAsync(handler)).toBe(false);
			expect(isAsync(endpoint.dispatch)).toBe(false);
			expect(compactSource(source)).toContain(
				"returnresponse(handler())",
			);
			expect(source).not.toContain("await");
			expectNoDynamicPromiseAdoption(source);
		});

		it("should classify Promise-producing chain callbacks only by their async declaration", () => {
			const middleware = () => Promise.resolve(ok("unsupported"));
			const store = () => Promise.resolve({ a: "unsupported" });
			const validator: ValidatorPlugin = (_schema, input) =>
				Promise.resolve({ content: input, success: true });
			const app = new Cudenix(
				new Module()
					.middleware(middleware)
					.store(store)
					.validator({ request: { query: {} } })
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			app.memory.validator = validator;
			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = jit(app, endpoint).toString();
			const compact = compactSource(source);

			expect(isAsync(middleware)).toBe(false);
			expect(isAsync(store)).toBe(false);
			expect(isAsync(validator)).toBe(false);
			expect(isAsync(endpoint.dispatch)).toBe(false);
			expect(compact).toContain("chain[0].handler(context,next_0)");
			expect(compact).toContain("chain[1].handler(context)");
			expect(compact).toContain("validator(");
			expect(source).not.toContain("await");
			expectNoDynamicPromiseAdoption(source);
		});

		it("should use awaitMap when a sync middleware returns an async next tail", async () => {
			const middleware = (
				_context: unknown,
				next: () => void | Promise<void>,
			) => next();
			const app = new Cudenix(
				new Module()
					.middleware(middleware)
					.store(async () => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const source = jit(app, endpoint).toString();
			const compact = compactSource(source);

			expect(isAsync(middleware)).toBe(false);
			expect(isAsync(endpoint.dispatch)).toBe(true);
			expect(compact).toContain("constnext_0=async()=>");
			expect(compact).toContain("awaitchain[0].handler(context,next_0)");
			expect(compact).toContain("awaitchain[1].handler(context)");
			expectNoDynamicPromiseAdoption(source);

			const result = await app.fetch(new Request("http://localhost/a"));

			expect(await result.text()).toBe("v1");
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

			expect(compactSource(source)).toContain(
				"awaitchain[0].handler(context,next_0)",
			);
			expect(compactSource(source)).toContain(
				"awaitchain[1].handler(context)",
			);
			expect(source).not.toContain("Promise");
			expect(source).not.toContain(".then(");

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
		it("should validate through a slot local without allocating Context", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(source).not.toContain("validatedRequest");
			expect(source).toContain("validatedQuery");
			expectNoContextAllocation(source);
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

			expect(local).not.toContain("validatedRequest");
			expect(local).toContain("validatedQuery");
			expectNoContextAllocation(local);
			expect(compactSource(full)).toContain("context.request=newEmpty()");
			expect(full).not.toContain("validatedRequest");
			expect(full).not.toContain("validatedQuery");
		});

		it("should keep a body value in a lean slot local", () => {
			const app = new Cudenix(
				new Module()
					.validator({ request: { body: {} } })
					.route("POST", "/a", () => ok("v1")),
			);

			app.memory.validator = echo;
			app.compile();

			const source = app.methods.POST!.endpoints[0]!.dispatch.toString();

			expect(source).not.toContain("validatedRequest");
			expect(source).toContain("validatedBody");
			expectNoContextAllocation(source);
			expect(source).toContain("parseBody");
		});

		it("should omit params detection when an endpoint has no params", () => {
			const source = jitSource(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			expect(compactSource(source)).toContain("context.store=newEmpty()");
			expect(source).not.toContain("request.params");
		});

		it("should parse lean params only after preceding stores succeed", () => {
			const source = jitSource(
				new Module()
					.store(() => ({ a: "v1" }))
					.validator({ request: { params: {} } })
					.route("GET", "/a/:id", () => ok("v1")),
			);
			const compact = compactSource(source);

			expect(
				compact.indexOf("chain[0].handler(undefined)"),
			).toBeGreaterThan(-1);
			expect(compact.indexOf("letparams=request.params")).toBeGreaterThan(
				compact.indexOf("chain[0].handler(undefined)"),
			);
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

			const source = app.methods.GET!.endpoints[0]!.dispatch.toString();

			const result = await app.fetch(
				new Request("http://localhost/a?value=first"),
			);

			expect(await result.text()).toBe("v1");
			expect(inputs).toEqual([{ value: "first" }, { step: 1 }]);
			expect(source).not.toContain("validatedRequest");
			expect(source).toContain("validatedQuery");
			expect((source.match(/parseQuery/g) ?? []).length).toBe(1);
		});

		it("should pass a transformed lean slot into a failing validator", async () => {
			const inputs: unknown[] = [];
			let calls = 0;
			let routes = 0;
			const validate: ValidatorPlugin = (_schema, input) => {
				inputs.push(input);
				calls++;

				return calls === 1
					? { content: { step: 1 }, success: true }
					: { content: ["bad"], success: false };
			};
			const app = new Cudenix(
				new Module()
					.validator({ request: { query: {} } })
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => {
						routes++;

						return ok("v1");
					}),
			);

			app.memory.validator = validate;
			app.compile();

			const result = await app.fetch(
				new Request("http://localhost/a?value=first"),
			);

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({ query: ["bad"] });
			expect(inputs).toEqual([{ value: "first" }, { step: 1 }]);
			expect(routes).toBe(0);
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

			expectNoContextAllocation(endpoint.dispatch.toString());
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

			expect(compactSource(source)).toContain("constserver=app.server");
			expectNoContextAllocation(source);
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

			expect(server.app.methods.GET!.endpoints[0]!.dispatch.length).toBe(
				2,
			);
			expect(await native.text()).toBe("v1");
			expect(await fallback.text()).toBe("v1");
			expect(inputs).toEqual([{ id: "42" }, { id: "42" }]);
		});

		it("should expose empty params when a route has no param keys", async () => {
			const app = new Cudenix(
				new Module()
					.validator({ request: { params: {} } })
					.route("GET", "/plain", (context) =>
						ok(context.request.params),
					),
			);

			app.memory.validator = echo;
			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;
			const nativeRequest = Object.assign(
				new Request("http://localhost/plain"),
				{ params: {} },
			);
			const native = await endpoint.dispatch(nativeRequest);
			const fallback = await app.fetch(
				new Request("http://localhost/plain"),
			);

			expect(endpoint.dispatch.length).toBe(1);
			expect(await native.json()).toEqual({});
			expect(await fallback.json()).toEqual({});
		});

		it("should prefer params already present on the request", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/users/:id", (context) =>
					ok(context.request.params.id),
				),
			);

			app.compile();

			const request = Object.assign(
				new Request("http://localhost/users/from-url"),
				{ params: { id: "from-request" } },
			);
			const result = await app.fetch(request);

			expect(await result.text()).toBe("from-request");
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

	describe("compiled validators", () => {
		const compiledApp = (
			module: ConstructorParameters<typeof Cudenix>[0],
			compiler?: ValidatorCompiler,
		) => {
			const app = new Cudenix(module);

			app.memory.validator = asyncEcho;

			if (compiler) {
				app.memory.validatorCompiler = compiler;
			}

			app.compile();

			return app;
		};

		it("should call the compiled slot instead of the runtime validator", () => {
			const app = compiledApp(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
				compileEcho,
			);

			const endpoint = app.methods.GET!.endpoints[0]!;
			const compact = compactSource(endpoint.dispatch.toString());

			expect(compact).toContain("compiled[0].query(validatedQuery)");
			expect(compact).not.toContain("validator(");
			expect(compact).not.toContain("chain[0].request");
			expect(endpoint.dispatch.toString()).not.toContain("await");
			expect(isAsync(endpoint.dispatch)).toBe(false);
		});

		it("should link the compiled validators and drop the runtime validator", () => {
			const compiled = compiledApp(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
				compileEcho,
			);
			const fallback = compiledApp(
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
			);

			expect(
				inspectJitFactoryDependencies(
					compiled,
					compiled.methods.GET!.endpoints[0]!,
				),
			).toEqual([
				"response",
				"parseQuery",
				"compiled",
				"Empty",
				"fail",
				"handler",
			]);
			expect(
				inspectJitFactoryDependencies(
					fallback,
					fallback.methods.GET!.endpoints[0]!,
				),
			).toEqual([
				"response",
				"parseQuery",
				"validator",
				"Empty",
				"fail",
				"chain",
				"handler",
			]);
		});

		it("should link both dependencies when only some slots compile", () => {
			const app = compiledApp(
				new Module()
					.validator({ request: { headers: {}, query: {} } })
					.route("GET", "/a", () => ok("v1")),
				(schema, type) =>
					type === "query" ? compileEcho(schema, type) : undefined,
			);

			const endpoint = app.methods.GET!.endpoints[0]!;

			expect(inspectJitFactoryDependencies(app, endpoint)).toEqual([
				"response",
				"validator",
				"Empty",
				"parseQuery",
				"compiled",
				"fail",
				"chain",
				"handler",
			]);
			expect(isAsync(endpoint.dispatch)).toBe(true);
		});

		it("should key the factory cache by per-slot compilation in both orders", () => {
			const queryModule = () =>
				new Module()
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1"));
			const headersModule = () =>
				new Module()
					.validator({ request: { headers: {} } })
					.route("GET", "/a", () => ok("v1"));

			const fallbackFirst = compiledApp(queryModule());
			const compiledSecond = compiledApp(queryModule(), compileEcho);
			const compiledFirst = compiledApp(headersModule(), compileEcho);
			const fallbackSecond = compiledApp(headersModule());

			expect(
				isAsync(fallbackFirst.methods.GET!.endpoints[0]!.dispatch),
			).toBe(true);
			expect(
				isAsync(compiledSecond.methods.GET!.endpoints[0]!.dispatch),
			).toBe(false);
			expect(
				isAsync(compiledFirst.methods.GET!.endpoints[0]!.dispatch),
			).toBe(false);
			expect(
				isAsync(fallbackSecond.methods.GET!.endpoints[0]!.dispatch),
			).toBe(true);
		});

		it("should keep an upstream middleware next callback in step with the compiled slots", async () => {
			const app = compiledApp(
				new Module()
					.middleware((_context, next) => next())
					.validator({ request: { query: {} } })
					.route("GET", "/a", () => ok("v1")),
				compileEcho,
			);

			const endpoint = app.methods.GET!.endpoints[0]!;
			const compact = compactSource(endpoint.dispatch.toString());

			expect(compact).toContain("constnext_0=()=>{");
			expect(isAsync(endpoint.dispatch)).toBe(false);

			const result = await app.fetch(new Request("http://localhost/a"));

			expect(await result.text()).toBe("v1");
		});

		it("should compile a shared validator link once per compiler", () => {
			const compiled: string[] = [];
			const compiler: ValidatorCompiler = (schema, type) => {
				compiled.push(type);

				return compileEcho(schema, type);
			};
			const module = new Module()
				.validator({ request: { query: {} } })
				.route("GET", "/a", () => ok("v1"))
				.route("GET", "/b", () => ok("v2"));

			const first = compiledApp(module, compiler);
			const second = compiledApp(module, compiler);

			expect(compiled).toEqual(["query"]);
			expect(isAsync(first.methods.GET!.endpoints[0]!.dispatch)).toBe(
				false,
			);
			expect(isAsync(second.methods.GET!.endpoints[1]!.dispatch)).toBe(
				false,
			);
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

			expect(compactSource(source)).toContain("function(request){");
			expect(source).not.toContain("match");
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

			expect(compactSource(source)).toContain("function(request,match){");
			expect(compactSource(source)).toContain("letparams=request.params");
			expect(compactSource(source)).toContain("if(!params)");
			expect(source).not.toContain('"cookies" in request');
			expect(source).toContain("decodePathParam");
			expect(compactSource(source)).not.toContain("match!==undefined");
			expect(compactSource(source)).not.toContain("value_0!==undefined");
		});

		it("should guard only optional path parameter captures", () => {
			const required = jitSource(
				new Module().route("GET", "/a/:p1", (context) =>
					ok(context.request.params),
				),
			);
			const optional = jitSource(
				new Module().route("GET", "/a/:p1?", (context) =>
					ok(context.request.params),
				),
			);

			expect(required).toContain("decodePathParam(match[2])");
			expect(compactSource(required)).not.toContain(
				"value_0!==undefined",
			);
			expect(compactSource(optional)).toContain("constvalue_0=match[2]");
			expect(compactSource(optional)).toContain("value_0!==undefined");
		});

		it("should conservatively guard captures without positional metadata", () => {
			const app = new Cudenix(
				new Module().route("GET", "/a/:p1", (context) =>
					ok(context.request.params),
				),
			);

			app.compile();

			const endpoint = app.methods.GET!.endpoints[0]!;

			delete endpoint.paramFlags;

			const source = jit(app, endpoint).toString();

			expect(compactSource(source)).toContain("constvalue_0=match[2]");
			expect(compactSource(source)).toContain("value_0!==undefined");
		});

		it("should guard optional rest captures and specialize rest by position", () => {
			const required = jitSource(
				new Module().route("GET", "/a/...rest", (context) =>
					ok(context.request.params),
				),
			);
			const optional = jitSource(
				new Module().route("GET", "/a/...rest?", (context) =>
					ok(context.request.params),
				),
			);
			const duplicate = jitSource(
				new Module().route("GET", "/:same/...same", (context) =>
					ok(context.request.params),
				),
			);

			expect(required).toContain(
				'match[2].split("/").map(decodePathParam)',
			);
			expect(compactSource(required)).not.toContain(
				"value_0!==undefined",
			);
			expect(compactSource(optional)).toContain("value_0!==undefined");
			expect(optional).toContain(
				'value_0.split("/").map(decodePathParam)',
			);
			expect(compactSource(duplicate)).toContain(
				'params["same"]=decodePathParam(match[2])',
			);
			expect(compactSource(duplicate)).toContain(
				'params["same"]=match[3].split("/").map(decodePathParam)',
			);
		});

		it("should build context without exposing the regexp match", () => {
			const source = jitSource(
				new Module().route("GET", "/a/:p1", (context) =>
					ok(context.request.params),
				),
			);

			expect(compactSource(source)).toContain(
				"context.request=newEmpty()",
			);
			expect(compactSource(source)).not.toContain("context.match");
		});

		it("should omit match when params validation has no captures", () => {
			const source = jitSource(
				new Module()
					.validator({ request: { params: {} } })
					.route("GET", "/plain", () => ok("v1")),
			);

			expect(compactSource(source)).toContain("function(request){");
			expect(source).not.toContain("match");
			expect(compactSource(source)).toContain("letparams=request.params");
		});

		it("should omit absent optional params through app.fetch", async () => {
			const app = new Cudenix(
				new Module()
					.route("GET", "/named/:value?", (context) =>
						ok(context.request.params),
					)
					.route("GET", "/rest/...values?", (context) =>
						ok(context.request.params),
					),
			);

			app.compile();

			const namedMissing = await app.fetch(
				new Request("http://localhost/named"),
			);
			const namedPresent = await app.fetch(
				new Request("http://localhost/named/v1"),
			);
			const restMissing = await app.fetch(
				new Request("http://localhost/rest"),
			);
			const restPresent = await app.fetch(
				new Request("http://localhost/rest/v1/v2"),
			);

			expect(await namedMissing.json()).toEqual({});
			expect(await namedPresent.json()).toEqual({ value: "v1" });
			expect(await restMissing.json()).toEqual({});
			expect(await restPresent.json()).toEqual({ values: ["v1", "v2"] });
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
