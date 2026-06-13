import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok, Reply } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: middlewares", () => {
	describe("pass-through", () => {
		it("should run the middleware before the handler and keep the handler's reply", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						events.push("middleware");

						await next();
					})
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
			expect(events).toEqual(["middleware", "handler"]);
		});

		it("should pass through when the middleware returns its next call", async () => {
			using server = serveApp(
				new Module()
					.middleware((_, next) => next())
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should resolve an asynchronous middleware before continuing the chain", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await Promise.resolve();

						events.push("middleware:resumed");

						await next();
					})
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
			expect(events).toEqual(["middleware:resumed", "handler"]);
		});
	});

	describe("ordering", () => {
		it("should run middlewares in registration order around the handler", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						events.push("first:before");

						await next();

						events.push("first:after");
					})
					.middleware(async (_, next) => {
						events.push("second:before");

						await next();

						events.push("second:after");
					})
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(events).toEqual([
				"first:before",
				"second:before",
				"handler",
				"second:after",
				"first:after",
			]);
		});

		it("should run the downstream chain once per next call", async () => {
			let runs = 0;

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();

						await next();
					})
					.route("GET", "/a", () => {
						runs++;

						return ok(`v${runs}`);
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v2");
			expect(runs).toBe(2);
		});
	});

	describe("short-circuiting", () => {
		it("should respond with the middleware fail and skip the handler", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.middleware(() => fail("blocked"))
					.route("GET", "/a", () => {
						ran = true;

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(400);
			expect(await result.text()).toBe("blocked");
			expect(ran).toBe(false);
		});

		it("should respond with the middleware ok and skip the handler", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.middleware(() => ok("cached"))
					.route("GET", "/a", () => {
						ran = true;

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("cached");
			expect(ran).toBe(false);
		});

		it("should respond 204 when the middleware halts the chain without a reply", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(() => {
						events.push("middleware");
					})
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
			expect(events).toEqual(["middleware"]);
		});

		it("should short-circuit with a fail resolved by an asynchronous middleware", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.middleware(async () => {
						await Promise.resolve();

						return fail("denied", { status: 401 });
					})
					.route("GET", "/a", () => {
						ran = true;

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(401);
			expect(await result.text()).toBe("denied");
			expect(ran).toBe(false);
		});

		it("should run the outer middleware's post-next code when an inner middleware short-circuits", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						events.push("outer:before");

						await next();

						events.push("outer:after");
					})
					.middleware(() => fail("blocked", { status: 403 }))
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("blocked");
			expect(events).toEqual(["outer:before", "outer:after"]);
		});

		it("should respond with content assigned directly to the response when halting", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.middleware((context) => {
						context.response.content = ok("direct");
					})
					.route("GET", "/a", () => {
						ran = true;

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("direct");
			expect(ran).toBe(false);
		});
	});

	describe("overriding", () => {
		it("should override the handler's reply when the middleware returns after next", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();

						return ok("outer");
					})
					.route("GET", "/a", () => ok("inner")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("outer");
		});

		it("should replace a downstream fail when returning after next", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (context, next) => {
						await next();

						const content = context.response.content;

						if (content instanceof Reply && !content.success) {
							return ok("recovered");
						}
					})
					.route("GET", "/a", () => fail("inner", { status: 500 })),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("recovered");
		});

		it("should let the outermost middleware apply the final override after next", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();

						return ok("outer");
					})
					.middleware(async (_, next) => {
						await next();

						return ok("middle");
					})
					.route("GET", "/a", () => ok("inner")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("outer");
		});

		it("should recover a downstream store short-circuit from a wrapping middleware after next", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (context, next) => {
						await next();

						const content = context.response.content;

						if (content instanceof Reply && !content.success) {
							return ok("recovered");
						}
					})
					.store(() => fail("blocked", { status: 403 }))
					.route("GET", "/a", () => ok("inner")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("recovered");
		});

		it("should not override a downstream fail when the middleware returns its next call", async () => {
			using server = serveApp(
				new Module()
					.middleware((_, next) => next())
					.route("GET", "/a", () => fail("inner", { status: 500 })),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
			expect(await result.text()).toBe("inner");
		});

		it("should override the handler with an ok carrying a falsy payload after next", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();

						return ok("");
					})
					.route("GET", "/a", () => ok("inner")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("");
		});
	});

	describe("thrown errors", () => {
		it("should surface a throw before next to the server's error handler and skip the handler", async () => {
			let caught: unknown;
			let ran = false;

			using server = serveApp(
				new Module()
					.middleware(() => {
						throw new Error("v1");
					})
					.route("GET", "/a", () => {
						ran = true;

						return ok("v2");
					}),
				{
					listen: {
						error(error) {
							caught = error;

							return new Response(undefined, { status: 500 });
						},
					},
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
			expect((caught as Error).message).toBe("v1");
			expect(ran).toBe(false);
		});

		it("should surface a throw after next to the server's error handler despite a downstream reply", async () => {
			let caught: unknown;

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();

						throw new Error("v1");
					})
					.route("GET", "/a", () => ok("v2")),
				{
					listen: {
						error(error) {
							caught = error;

							return new Response(undefined, { status: 500 });
						},
					},
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
			expect((caught as Error).message).toBe("v1");
		});
	});

	describe("request gating", () => {
		it("should gate the handler on a request header", async () => {
			using server = serveApp(
				new Module()
					.middleware((context, next) => {
						if (!context.request.raw.headers.get("authorization")) {
							return fail("unauthorized", { status: 401 });
						}

						return next();
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const denied = await server.fetch("/a");
			const allowed = await server.fetch("/a", {
				headers: { authorization: "token" },
			});

			expect(denied.status).toBe(401);
			expect(await denied.text()).toBe("unauthorized");
			expect(allowed.status).toBe(200);
			expect(await allowed.text()).toBe("v1");
		});

		it("should gate a static-value route through the middleware", async () => {
			using server = serveApp(
				new Module()
					.middleware((context, next) => {
						if (!context.request.raw.headers.get("authorization")) {
							return fail("unauthorized", { status: 401 });
						}

						return next();
					})
					.route("GET", "/a", ok("v1")),
			);

			const denied = await server.fetch("/a");
			const allowed = await server.fetch("/a", {
				headers: { authorization: "token" },
			});

			expect(denied.status).toBe(401);
			expect(allowed.status).toBe(200);
			expect(await allowed.text()).toBe("v1");
		});
	});

	describe("stores", () => {
		it("should expose store values from earlier links to the middleware", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.middleware((context) => ok(context.store.a))
					.route("GET", "/a", () => ok("v2")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should run a store declared after the middleware inside its next call", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						events.push("middleware:before");

						await next();

						events.push("middleware:after");
					})
					.store(() => {
						events.push("store");

						return { a: "v1" };
					})
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe("v1");
			expect(events).toEqual([
				"middleware:before",
				"store",
				"middleware:after",
			]);
		});
	});

	describe("scoping", () => {
		it("should not apply to routes declared before the middleware", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.middleware(() => fail("blocked", { status: 403 }))
					.route("GET", "/b", () => ok("v2")),
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(before.status).toBe(200);
			expect(await before.text()).toBe("v1");
			expect(after.status).toBe(403);
		});

		it("should not run the middleware when no route matches", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.middleware((_, next) => {
						ran = true;

						return next();
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/b");

			expect(result.status).toBe(404);
			expect(ran).toBe(false);
		});
	});

	describe("per-request", () => {
		it("should run the middleware on every request", async () => {
			let runs = 0;

			using server = serveApp(
				new Module()
					.middleware((_, next) => {
						runs++;

						return next();
					})
					.route("GET", "/a", () => ok("v1")),
			);

			await server.fetch("/a");
			await server.fetch("/a");

			expect(runs).toBe(2);
		});
	});

	describe("response metadata", () => {
		it("should not apply response headers set by a middleware yet (migration gap)", async () => {
			using server = serveApp(
				new Module()
					.middleware((context, next) => {
						context.response.headers["x-a"] = "v1";

						return next();
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("x-a")).toBeNull();
		});

		it("should not apply response cookies set by a middleware yet (migration gap)", async () => {
			using server = serveApp(
				new Module()
					.middleware((context, next) => {
						context.response.cookies.a = "v1";

						return next();
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("set-cookie")).toBeNull();
		});
	});
});
