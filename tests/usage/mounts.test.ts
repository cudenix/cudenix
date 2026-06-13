import { describe, expect, expectTypeOf, it } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: mounts", () => {
	describe("prefixes", () => {
		it("should nest mounted routes under the parent prefix when only the parent declares one", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).mount(
					new Module().route("GET", "/a", () => ok("v1")),
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should serve mounted routes under the mounted module's own prefix when the parent has none", async () => {
			using server = serveApp(
				new Module().mount(
					new Module({ prefix: "/v1" }).route("GET", "/a", () =>
						ok("v1"),
					),
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should compose the parent and mounted module prefixes", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).mount(
					new Module({ prefix: "/v2" }).route("GET", "/a", () =>
						ok("v1"),
					),
				),
			);

			const composed = await server.fetch("/v1/v2/a");
			const childOnly = await server.fetch("/v2/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(childOnly.status).toBe(404);
		});

		it("should treat a root mounted prefix the same as no prefix", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module({ prefix: "/" }).route("GET", "/a", () =>
							ok("v1"),
						),
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const mounted = await server.fetch("/a");
			const sibling = await server.fetch("/b");

			expect(mounted.status).toBe(200);
			expect(await mounted.text()).toBe("v1");
			expect(await sibling.text()).toBe("v2");
		});

		it("should serve routes under a multi-segment mounted prefix", async () => {
			using server = serveApp(
				new Module().mount(
					new Module({ prefix: "/v1/v2" }).route("GET", "/a", () =>
						ok("v1"),
					),
				),
			);

			const prefixed = await server.fetch("/v1/v2/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should serve a root route at the mounted prefix itself", async () => {
			using server = serveApp(
				new Module().mount(
					new Module({ prefix: "/v1" }).route("GET", "/", () =>
						ok("v1"),
					),
				),
			);

			const exact = await server.fetch("/v1");
			const trailing = await server.fetch("/v1/");

			expect(exact.status).toBe(200);
			expect(await exact.text()).toBe("v1");
			expect(trailing.status).toBe(404);
		});

		it("should match a param segment declared in the mounted prefix", async () => {
			using server = serveApp(
				new Module().mount(
					new Module({ prefix: "/v1/:p1" }).route("GET", "/a", () =>
						ok("v1"),
					),
				),
			);

			const hit = await server.fetch("/v1/1/a");
			const miss = await server.fetch("/v1/a");

			expect(hit.status).toBe(200);
			expect(await hit.text()).toBe("v1");
			expect(miss.status).toBe(404);
		});
	});

	describe("prefix bleed", () => {
		it("should not nest routes declared before the mount under the mounted prefix", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.mount(
						new Module({ prefix: "/v1" }).route("GET", "/b", () =>
							ok("v2"),
						),
					),
			);

			const before = await server.fetch("/a");
			const mounted = await server.fetch("/v1/b");
			const nested = await server.fetch("/v1/a");

			expect(await before.text()).toBe("v1");
			expect(await mounted.text()).toBe("v2");
			expect(nested.status).toBe(404);
		});

		it("should keep sibling routes declared after an unprefixed mount at the parent's root", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module().route("GET", "/a", () => ok("v1")))
					.route("GET", "/b", () => ok("v2")),
			);

			const mounted = await server.fetch("/a");
			const sibling = await server.fetch("/b");

			expect(await mounted.text()).toBe("v1");
			expect(await sibling.text()).toBe("v2");
		});

		it("should compose the prefixes of consecutive prefixed mounts", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module({ prefix: "/v1" }).route("GET", "/a", () =>
							ok("v1"),
						),
					)
					.mount(
						new Module({ prefix: "/v2" }).route("GET", "/b", () =>
							ok("v2"),
						),
					),
			);

			const first = await server.fetch("/v1/a");
			const second = await server.fetch("/v1/v2/b");
			const bare = await server.fetch("/v2/b");

			expect(await first.text()).toBe("v1");
			expect(second.status).toBe(200);
			expect(await second.text()).toBe("v2");
			expect(bare.status).toBe(404);
		});

		it("should nest sibling routes declared after a prefixed mount under that prefix", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module({ prefix: "/v1" }).route("GET", "/a", () =>
							ok("v1"),
						),
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const mounted = await server.fetch("/v1/a");
			const nested = await server.fetch("/v1/b");
			const bare = await server.fetch("/b");

			expect(await mounted.text()).toBe("v1");
			expect(await nested.text()).toBe("v2");
			expect(bare.status).toBe(404);
		});

		it("should nest later siblings under the prefix of a mounted module with no routes", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module({ prefix: "/v1" }))
					.route("GET", "/a", () => ok("v1")),
			);

			const nested = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(nested.status).toBe(200);
			expect(await nested.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should bleed a deeply nested mount's composed prefix onto a later sibling", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module({ prefix: "/v1" }).mount(
							new Module({ prefix: "/v2" }),
						),
					)
					.route("GET", "/a", () => ok("v1")),
			);

			const nested = await server.fetch("/v1/v2/a");
			const partial = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(nested.status).toBe(200);
			expect(await nested.text()).toBe("v1");
			expect(partial.status).toBe(404);
			expect(bare.status).toBe(404);
		});

		it("should bleed a param-segment mounted prefix onto a later sibling", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module({ prefix: "/v1/:p1" }))
					.route("GET", "/a", () => ok("v1")),
			);

			const hit = await server.fetch("/v1/1/a");
			const miss = await server.fetch("/v1/a");

			expect(hit.status).toBe(200);
			expect(await hit.text()).toBe("v1");
			expect(miss.status).toBe(404);
		});
	});

	describe("nesting", () => {
		it("should compose prefixes across nested mounts", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).mount(
					new Module({ prefix: "/v2" }).mount(
						new Module({ prefix: "/v3" }).route("GET", "/a", () =>
							ok("v1"),
						),
					),
				),
			);

			const composed = await server.fetch("/v1/v2/v3/a");
			const partial = await server.fetch("/v2/v3/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(partial.status).toBe(404);
		});

		it("should apply a middleware declared in an outer mounted module to deeply mounted routes", async () => {
			using server = serveApp(
				new Module().mount(
					new Module()
						.middleware(() => fail("blocked", { status: 403 }))
						.mount(new Module().route("GET", "/a", () => ok("v1"))),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("blocked");
		});
	});

	describe("middlewares", () => {
		it("should apply a mounted module's middleware to its own routes", async () => {
			using server = serveApp(
				new Module().mount(
					new Module()
						.middleware(() => fail("blocked", { status: 403 }))
						.route("GET", "/a", () => ok("v1")),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("blocked");
		});

		it("should run a parent middleware around the mounted module's middleware", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						events.push("parent:before");

						await next();

						events.push("parent:after");
					})
					.mount(
						new Module()
							.middleware(async (_, next) => {
								events.push("mounted:before");

								await next();

								events.push("mounted:after");
							})
							.route("GET", "/a", () => {
								events.push("handler");

								return ok("v1");
							}),
					),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(events).toEqual([
				"parent:before",
				"mounted:before",
				"handler",
				"mounted:after",
				"parent:after",
			]);
		});

		it("should not apply a parent middleware declared after the mount to mounted routes", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module().route("GET", "/a", () => ok("v1")))
					.middleware(() => fail("blocked", { status: 403 }))
					.route("GET", "/b", () => ok("v2")),
			);

			const mounted = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(mounted.status).toBe(200);
			expect(await mounted.text()).toBe("v1");
			expect(after.status).toBe(403);
		});

		it("should apply a mounted module's middleware to sibling routes declared after the mount", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.mount(
						new Module().middleware(() =>
							fail("blocked", { status: 403 }),
						),
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(before.status).toBe(200);
			expect(await before.text()).toBe("v1");
			expect(after.status).toBe(403);
		});

		it("should apply one mounted module's middleware to a sibling mount declared after it", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module().middleware(() =>
							fail("blocked", { status: 403 }),
						),
					)
					.mount(new Module().route("GET", "/a", () => ok("v1"))),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("blocked");
		});

		it("should run a bubbled mount middleware around a parent middleware declared after the mount", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.mount(
						new Module().middleware(async (_, next) => {
							events.push("mount:before");

							await next();

							events.push("mount:after");
						}),
					)
					.middleware(async (_, next) => {
						events.push("after:before");

						await next();

						events.push("after:after");
					})
					.route("GET", "/a", () => {
						events.push("handler");

						return ok("v1");
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(events).toEqual([
				"mount:before",
				"after:before",
				"handler",
				"after:after",
				"mount:after",
			]);
		});
	});

	describe("stores", () => {
		it("should expose a mounted module's store to its own routes", async () => {
			using server = serveApp(
				new Module().mount(
					new Module()
						.store(() => ({ a: "v1" }))
						.route("GET", "/a", (context) => ok(context.store.a)),
				),
			);

			const result = await server.fetch("/a");

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

		it("should merge a parent store with a mounted module's store on a route declared after the mount", async () => {
			using server = serveApp(
				new Module()
					.store((): { a: string } => ({ a: "v1" }))
					.mount(
						new Module().store((): { b: string } => ({ b: "v2" })),
					)
					.route("GET", "/a", (context) => {
						expectTypeOf(context.store).branded.toEqualTypeOf<{
							a: string;
							b: string;
						}>();

						return ok(`${context.store.a}:${context.store.b}`);
					}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1:v2");
		});

		it("should let a mounted module's store overwrite a parent store key", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.mount(new Module().store(() => ({ a: "v2" })))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v2");
		});

		it("should expose a mounted module's store only to routes declared after the mount", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.route("GET", "/a", (context) => {
						expectTypeOf(context.store).toEqualTypeOf<
							NonNullable<unknown>
						>();

						return ok("a" in context.store ? "present" : "absent");
					})
					.mount(
						new Module().store(() => {
							events.push("store");

							return { a: "v1" };
						}),
					)
					.route("GET", "/b", (context) => ok(context.store.a)),
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(await before.text()).toBe("absent");
			expect(after.status).toBe(200);
			expect(await after.text()).toBe("v1");
			expect(events).toEqual(["store"]);
		});
	});

	describe("precedence", () => {
		it("should prefer a parent route registered before a mounted route at the same path", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("parent"))
					.mount(
						new Module().route("GET", "/a", () => ok("mounted")),
					),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("parent");
		});

		it("should prefer a mounted route registered before a parent route at the same path", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module().route("GET", "/a", () => ok("mounted")))
					.route("GET", "/a", () => ok("parent")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("mounted");
		});
	});

	describe("compilation", () => {
		it("should serve siblings normally when the mounted module declares no links", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module())
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should serve a static-value route inside a mounted module at the composed path", async () => {
			using server = serveApp(
				new Module().mount(
					new Module({ prefix: "/v1" }).route("GET", "/a", ok("v1")),
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});
	});
});
