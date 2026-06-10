import { describe, expect, expectTypeOf, it } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: stores", () => {
	describe("providing", () => {
		it("should expose the store value to the route handler", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should expose multiple keys returned by a single store", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1", b: "v2" }))
					.route("GET", "/a", (context) =>
						ok(`${context.store.a}:${context.store.b}`),
					),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1:v2");
		});

		it("should await an asynchronous store", async () => {
			using server = serveApp(
				new Module()
					.store(async () => {
						await Promise.resolve();

						return { a: "v1" };
					})
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});
	});

	describe("merging", () => {
		it("should merge values from consecutive stores", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.store(() => ({ b: "v2" }))
					.route("GET", "/a", (context) =>
						ok(`${context.store.a}:${context.store.b}`),
					),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1:v2");
		});

		it("should let a later store overwrite an earlier key", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.store(() => ({ a: "v2" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v2");
		});

		it("should replace a nested object wholesale instead of deep-merging it", async () => {
			using server = serveApp(
				new Module()
					.store((): { a: { b: string; c: string } } => ({
						a: { b: "v1", c: "v2" },
					}))
					.store((): { a: { b: string } } => ({ a: { b: "v3" } }))
					.route("GET", "/a", (context) => {
						expectTypeOf(context.store.a).branded.toEqualTypeOf<{
							b: string;
						}>();

						return ok(context.store.a);
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.json()).toEqual({ b: "v3" });
		});

		it("should expose earlier store values to a later store", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.store((context) => ({ b: `${context.store.a}:v2` }))
					.route("GET", "/a", (context) => ok(context.store.b)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1:v2");
		});
	});

	describe("ordering", () => {
		it("should run stores in registration order before the handler", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.store(() => {
						events.push("first");

						return { a: "v1" };
					})
					.store(() => {
						events.push("second");

						return { b: "v2" };
					})
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(events).toEqual(["first", "second", "handler"]);
		});
	});

	describe("short-circuiting", () => {
		it("should respond with the store fail and skip the handler", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.store(() => fail("blocked"))
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

		it("should respond with a fail resolved by an asynchronous store", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.store(async () => {
						await Promise.resolve();

						return fail("blocked");
					})
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

		it("should skip later stores when an earlier store fails", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.store(() => {
						events.push("first");

						return fail("blocked");
					})
					.store(() => {
						events.push("second");

						return { a: "v1" };
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(400);
			expect(events).toEqual(["first"]);
		});
	});

	describe("thrown errors", () => {
		it("should surface a store throw to the server's error handler and skip the handler", async () => {
			let caught: unknown;
			let ran = false;

			using server = serveApp(
				new Module()
					.store(() => {
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

		it("should surface an asynchronous store rejection to the server's error handler", async () => {
			let caught: unknown;
			let ran = false;

			using server = serveApp(
				new Module()
					.store(async () => {
						await Promise.resolve();

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
	});

	describe("request gating", () => {
		it("should gate the handler on a request header", async () => {
			using server = serveApp(
				new Module()
					.store((context) => {
						const a =
							context.request.raw.headers.get("authorization");

						return a
							? { a }
							: fail("unauthorized", { status: 401 });
					})
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const denied = await server.fetch("/a");
			const allowed = await server.fetch("/a", {
				headers: { authorization: "token" },
			});

			expect(denied.status).toBe(401);
			expect(await denied.text()).toBe("unauthorized");
			expect(allowed.status).toBe(200);
			expect(await allowed.text()).toBe("token");
		});

		it("should gate a static-value route through the store", async () => {
			using server = serveApp(
				new Module()
					.store((context) =>
						context.request.raw.headers.get("authorization")
							? { a: "v1" }
							: fail("unauthorized", { status: 401 }),
					)
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

	describe("scoping", () => {
		it("should not run for routes declared before the store", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.store(() => {
						events.push("store");

						return { a: "v2" };
					})
					.route("GET", "/b", (context) => ok(context.store.a)),
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(await before.text()).toBe("v1");
			expect(await after.text()).toBe("v2");
			expect(events).toEqual(["store"]);
		});

		it("should keep a group store scoped to the group", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.group(
						(module) =>
							module
								.store(() => {
									events.push("store");

									return { a: "v1" };
								})
								.route("GET", "/a", (context) =>
									ok(context.store.a),
								),
						{ prefix: "/v1" },
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const grouped = await server.fetch("/v1/a");
			const sibling = await server.fetch("/b");

			expect(await grouped.text()).toBe("v1");
			expect(await sibling.text()).toBe("v2");
			expect(events).toEqual(["store"]);
		});

		it("should apply a parent store declared before the group to grouped routes", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.group(
						(module) =>
							module.route("GET", "/a", (context) =>
								ok(context.store.a),
							),
						{ prefix: "/v1" },
					),
			);

			const result = await server.fetch("/v1/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should apply a parent store declared before the mount to mounted routes", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.store(() => {
						events.push("store");

						return { a: "v1" };
					})
					.mount(new Module().route("GET", "/a", () => ok("v2"))),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v2");
			expect(events).toEqual(["store"]);
		});

		it("should apply a mounted module's store to sibling routes declared after the mount", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.mount(
						new Module().store(() => {
							events.push("store");

							return { a: "v2" };
						}),
					)
					.route("GET", "/b", (context) => ok(context.store.a)),
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(await before.text()).toBe("v1");
			expect(await after.text()).toBe("v2");
			expect(events).toEqual(["store"]);
		});

		it("should not run for an unmatched path", async () => {
			let runs = 0;

			using server = serveApp(
				new Module()
					.store(() => {
						runs++;

						return { a: "v1" };
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const miss = await server.fetch("/b");

			expect(miss.status).toBe(404);
			expect(runs).toBe(0);
		});
	});

	describe("per-request", () => {
		it("should run the store on every request", async () => {
			let runs = 0;

			using server = serveApp(
				new Module()
					.store(() => {
						runs++;

						return { a: "v1" };
					})
					.route("GET", "/a", () => ok("v1")),
			);

			await server.fetch("/a");
			await server.fetch("/a");

			expect(runs).toBe(2);
		});

		it("should compute store values per request", async () => {
			using server = serveApp(
				new Module()
					.store((context) => ({
						a: context.request.raw.headers.get("x-a") ?? "v1",
					}))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const first = await server.fetch("/a", {
				headers: { "x-a": "v2" },
			});
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("v2");
			expect(await second.text()).toBe("v1");
		});

		it("should not leak store mutations into later requests", async () => {
			using server = serveApp(
				new Module()
					.store((): { a: string } => ({ a: "v1" }))
					.route("GET", "/a", (context) => {
						const a = context.store.a;

						context.store.a = "v2";

						return ok(a);
					}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});
	});
});
