import { describe, expect, expectTypeOf, it } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: groups", () => {
	describe("prefixes", () => {
		it("should serve group routes at the parent's root when no prefix is given", async () => {
			using server = serveApp(
				new Module().group((module) =>
					module.route("GET", "/a", () => ok("v1")),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should treat a root group prefix the same as no prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/" },
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should serve group routes under the group prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/v1" },
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should serve routes under a multi-segment group prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/v1/v2" },
				),
			);

			const prefixed = await server.fetch("/v1/v2/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should serve a root route at the group prefix itself", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/", () => ok("v1")),
					{ prefix: "/v1" },
				),
			);

			const exact = await server.fetch("/v1");
			const trailing = await server.fetch("/v1/");

			expect(exact.status).toBe(200);
			expect(await exact.text()).toBe("v1");
			expect(trailing.status).toBe(404);
		});

		it("should match a param segment declared in the group prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/v1/:p1" },
				),
			);

			const hit = await server.fetch("/v1/1/a");
			const miss = await server.fetch("/v1/a");

			expect(hit.status).toBe(200);
			expect(await hit.text()).toBe("v1");
			expect(miss.status).toBe(404);
		});

		it("should compose the module prefix with the group prefix", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/v2" },
				),
			);

			const result = await server.fetch("/v1/v2/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});
	});

	describe("mounts", () => {
		it("should compose a mounted module's prefix with its group prefix", async () => {
			using server = serveApp(
				new Module().mount(
					new Module({ prefix: "/v1" }).group(
						(module) => module.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v2" },
					),
				),
			);

			const composed = await server.fetch("/v1/v2/a");
			const childOnly = await server.fetch("/v2/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(childOnly.status).toBe(404);
		});

		it("should nest a module mounted inside the group under the group prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) =>
						module.mount(
							new Module({ prefix: "/v2" }).route(
								"GET",
								"/a",
								() => ok("v1"),
							),
						),
					{ prefix: "/v1" },
				),
			);

			const composed = await server.fetch("/v1/v2/a");
			const childOnly = await server.fetch("/v2/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(childOnly.status).toBe(404);
		});

		it("should compose prefixes across a group, a mounted module, and a nested group", async () => {
			using server = serveApp(
				new Module().group(
					(outer) =>
						outer.mount(
							new Module({ prefix: "/v2" }).group(
								(inner) =>
									inner.route("GET", "/a", () => ok("v1")),
								{ prefix: "/v3" },
							),
						),
					{ prefix: "/v1" },
				),
			);

			const composed = await server.fetch("/v1/v2/v3/a");
			const partial = await server.fetch("/v2/v3/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(partial.status).toBe(404);
		});

		it("should nest a group declared after a prefixed mount under the mounted prefix", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module({ prefix: "/v1" }).route("GET", "/a", () =>
							ok("v1"),
						),
					)
					.group(
						(module) => module.route("GET", "/b", () => ok("v2")),
						{ prefix: "/v2" },
					),
			);

			const mounted = await server.fetch("/v1/a");
			const nested = await server.fetch("/v1/v2/b");
			const bare = await server.fetch("/v2/b");

			expect(await mounted.text()).toBe("v1");
			expect(nested.status).toBe(200);
			expect(await nested.text()).toBe("v2");
			expect(bare.status).toBe(404);
		});

		it("should apply a mounted module's middleware to a group declared after the mount", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module().middleware(() =>
							fail("blocked", { status: 403 }),
						),
					)
					.group(
						(module) => module.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					),
			);

			const result = await server.fetch("/v1/a");

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("blocked");
		});

		it("should expose a mounted module's store to a group declared after the mount", async () => {
			using server = serveApp(
				new Module()
					.mount(new Module().store(() => ({ a: "v1" })))
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
	});

	describe("nesting", () => {
		it("should compose nested group prefixes", async () => {
			using server = serveApp(
				new Module().group(
					(outer) =>
						outer.group(
							(inner) => inner.route("GET", "/a", () => ok("v1")),
							{ prefix: "/v2" },
						),
					{ prefix: "/v1" },
				),
			);

			const composed = await server.fetch("/v1/v2/a");
			const innerOnly = await server.fetch("/v2/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(innerOnly.status).toBe(404);
		});

		it("should apply an outer group middleware to inner group routes", async () => {
			using server = serveApp(
				new Module().group(
					(outer) =>
						outer
							.middleware(() => fail("blocked", { status: 403 }))
							.group(
								(inner) =>
									inner.route("GET", "/a", () => ok("v1")),
								{ prefix: "/v2" },
							),
					{ prefix: "/v1" },
				),
			);

			const result = await server.fetch("/v1/v2/a");

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("blocked");
		});

		it("should keep an inner group middleware scoped to the inner group", async () => {
			using server = serveApp(
				new Module().group(
					(outer) =>
						outer
							.group(
								(inner) =>
									inner
										.middleware(() =>
											fail("blocked", { status: 403 }),
										)
										.route("GET", "/a", () => ok("v1")),
								{ prefix: "/v2" },
							)
							.route("GET", "/b", () => ok("v2")),
					{ prefix: "/v1" },
				),
			);

			const nested = await server.fetch("/v1/v2/a");
			const sibling = await server.fetch("/v1/b");

			expect(nested.status).toBe(403);
			expect(sibling.status).toBe(200);
			expect(await sibling.text()).toBe("v2");
		});
	});

	describe("siblings", () => {
		it("should serve sibling groups under their own prefixes", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) => module.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.group(
						(module) => module.route("GET", "/a", () => ok("v2")),
						{ prefix: "/v2" },
					),
			);

			const first = await server.fetch("/v1/a");
			const second = await server.fetch("/v2/a");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v2");
		});

		it("should merge routes from sibling groups sharing a prefix", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) => module.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.group(
						(module) => module.route("GET", "/b", () => ok("v2")),
						{ prefix: "/v1" },
					),
			);

			const first = await server.fetch("/v1/a");
			const second = await server.fetch("/v1/b");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v2");
		});

		it("should keep one group's middleware from affecting a sibling group", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) =>
							module
								.middleware(() =>
									fail("blocked", { status: 403 }),
								)
								.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.group(
						(module) => module.route("GET", "/a", () => ok("v2")),
						{ prefix: "/v2" },
					),
			);

			const denied = await server.fetch("/v1/a");
			const allowed = await server.fetch("/v2/a");

			expect(denied.status).toBe(403);
			expect(allowed.status).toBe(200);
			expect(await allowed.text()).toBe("v2");
		});

		it("should keep a group middleware scoped to the group", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) =>
							module
								.middleware(() =>
									fail("blocked", { status: 403 }),
								)
								.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const grouped = await server.fetch("/v1/a");
			const sibling = await server.fetch("/b");

			expect(grouped.status).toBe(403);
			expect(sibling.status).toBe(200);
			expect(await sibling.text()).toBe("v2");
		});

		it("should not nest sibling routes declared after a prefixed group under its prefix", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) => module.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const grouped = await server.fetch("/v1/a");
			const sibling = await server.fetch("/b");
			const nested = await server.fetch("/v1/b");

			expect(await grouped.text()).toBe("v1");
			expect(await sibling.text()).toBe("v2");
			expect(nested.status).toBe(404);
		});
	});

	describe("precedence", () => {
		it("should prefer a parent route registered before a group route at the same path", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("parent"))
					.group((module) =>
						module.route("GET", "/a", () => ok("group")),
					),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("parent");
		});

		it("should prefer a group route registered before a parent route at the same path", async () => {
			using server = serveApp(
				new Module()
					.group((module) =>
						module.route("GET", "/a", () => ok("group")),
					)
					.route("GET", "/a", () => ok("parent")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("group");
		});
	});

	describe("scoping", () => {
		it("should leave a parent route declared before the group unaffected by group links", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.group(
						(module) =>
							module
								.middleware(() =>
									fail("blocked", { status: 403 }),
								)
								.route("GET", "/b", () => ok("v2")),
						{ prefix: "/v1" },
					),
			);

			const before = await server.fetch("/a");
			const grouped = await server.fetch("/v1/b");

			expect(before.status).toBe(200);
			expect(await before.text()).toBe("v1");
			expect(grouped.status).toBe(403);
		});

		it("should wrap a group's middleware with a parent middleware declared before the group", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						events.push("parent:before");

						await next();

						events.push("parent:after");
					})
					.group(
						(module) =>
							module
								.middleware(async (_, next) => {
									events.push("group:before");

									await next();

									events.push("group:after");
								})
								.route("GET", "/a", () => {
									events.push("handler");

									return ok("v1");
								}),
						{ prefix: "/v1" },
					),
			);

			const result = await server.fetch("/v1/a");

			expect(result.status).toBe(200);
			expect(events).toEqual([
				"parent:before",
				"group:before",
				"handler",
				"group:after",
				"parent:after",
			]);
		});

		it("should not apply a parent middleware declared after the group to grouped routes", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) => module.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.middleware(() => fail("blocked", { status: 403 }))
					.route("GET", "/b", () => ok("v2")),
			);

			const grouped = await server.fetch("/v1/a");
			const after = await server.fetch("/b");

			expect(grouped.status).toBe(200);
			expect(await grouped.text()).toBe("v1");
			expect(after.status).toBe(403);
		});

		it("should merge a parent store with a group store on the grouped route", async () => {
			using server = serveApp(
				new Module()
					.store((): { a: string } => ({ a: "v1" }))
					.group(
						(module) =>
							module
								.store((): { b: string } => ({ b: "v2" }))
								.route("GET", "/a", (context) => {
									expectTypeOf(
										context.store,
									).branded.toEqualTypeOf<{
										a: string;
										b: string;
									}>();

									return ok(
										`${context.store.a}:${context.store.b}`,
									);
								}),
						{ prefix: "/v1" },
					),
			);

			const result = await server.fetch("/v1/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1:v2");
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
	});

	describe("compilation", () => {
		it("should invoke the group factory once at startup, not per request", async () => {
			let builds = 0;

			using server = serveApp(
				new Module().group(
					(module) => {
						builds++;

						return module.route("GET", "/a", () => ok("v1"));
					},
					{ prefix: "/v1" },
				),
			);

			const first = await server.fetch("/v1/a");
			const second = await server.fetch("/v1/a");

			expect(first.status).toBe(200);
			expect(second.status).toBe(200);
			expect(builds).toBe(1);
		});

		it("should serve siblings normally when the group declares no routes", async () => {
			using server = serveApp(
				new Module()
					.group((module) => module, { prefix: "/v1" })
					.route("GET", "/a", () => ok("v1")),
			);

			const sibling = await server.fetch("/a");
			const empty = await server.fetch("/v1");

			expect(sibling.status).toBe(200);
			expect(await sibling.text()).toBe("v1");
			expect(empty.status).toBe(404);
		});

		it("should serve a static-value route inside a group at the composed path", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/a", ok("v1")),
					{ prefix: "/v1" },
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
