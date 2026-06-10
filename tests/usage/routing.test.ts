import { describe, expect, expectTypeOf, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: routing", () => {
	describe("paths", () => {
		it("should serve a route registered at the root path", async () => {
			using server = serveApp(
				new Module().route("GET", "/", () => ok("v1")),
			);

			const result = await server.fetch("/");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should 404 an unknown path when only the root is registered", async () => {
			using server = serveApp(
				new Module().route("GET", "/", () => ok("v1")),
			);

			const hit = await server.fetch("/");
			const miss = await server.fetch("/a");

			expect(hit.status).toBe(200);
			expect(miss.status).toBe(404);
		});

		it("should dispatch a deeply nested static path", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/b/c", () => ok("v1")),
			);

			const result = await server.fetch("/a/b/c");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should 404 a request with a trailing slash on a static route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const exact = await server.fetch("/a");
			const trailing = await server.fetch("/a/");

			expect(exact.status).toBe(200);
			expect(trailing.status).toBe(404);
		});

		it("should 404 a request whose casing differs from the route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const exact = await server.fetch("/a");
			const upper = await server.fetch("/A");

			expect(exact.status).toBe(200);
			expect(upper.status).toBe(404);
		});

		it("should ignore the query string when matching a path", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a?b=c");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should 404 a request that extends past a registered path", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const exact = await server.fetch("/a");
			const extended = await server.fetch("/a/b");

			expect(exact.status).toBe(200);
			expect(extended.status).toBe(404);
		});

		it("should 404 a request that stops short of a registered path", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/b", () => ok("v1")),
			);

			const exact = await server.fetch("/a/b");
			const partial = await server.fetch("/a");

			expect(exact.status).toBe(200);
			expect(partial.status).toBe(404);
		});
	});

	describe("methods", () => {
		describe("dispatch", () => {
			it("should dispatch a single GET route", async () => {
				using server = serveApp(
					new Module().route("GET", "/a", () => ok("get")),
				);

				const result = await server.fetch("/a");

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("get");
			});

			it("should dispatch a single POST route", async () => {
				using server = serveApp(
					new Module().route("POST", "/a", () => ok("post")),
				);

				const result = await server.fetch("/a", { method: "POST" });

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("post");
			});

			it("should dispatch PUT, PATCH, and DELETE routes", async () => {
				using server = serveApp(
					new Module()
						.route("PUT", "/a", () => ok("put"))
						.route("PATCH", "/a", () => ok("patch"))
						.route("DELETE", "/a", () => ok("delete")),
				);

				const put = await server.fetch("/a", { method: "PUT" });
				const patch = await server.fetch("/a", { method: "PATCH" });
				const remove = await server.fetch("/a", { method: "DELETE" });

				expect(await put.text()).toBe("put");
				expect(await patch.text()).toBe("patch");
				expect(await remove.text()).toBe("delete");
			});
		});

		describe("discrimination", () => {
			it("should route by method when GET and POST share a path", async () => {
				using server = serveApp(
					new Module()
						.route("GET", "/a", () => ok("get"))
						.route("POST", "/a", () => ok("post")),
				);

				const get = await server.fetch("/a");
				const post = await server.fetch("/a", { method: "POST" });

				expect(await get.text()).toBe("get");
				expect(await post.text()).toBe("post");
			});

			it("should 404 a known path requested with an unregistered method", async () => {
				using server = serveApp(
					new Module().route("GET", "/a", () => ok("get")),
				);

				const get = await server.fetch("/a");
				const result = await server.fetch("/a", { method: "DELETE" });

				expect(get.status).toBe(200);
				expect(result.status).toBe(404);
			});

			it("should 404 a path that exists only under a different method", async () => {
				using server = serveApp(
					new Module()
						.route("GET", "/a", () => ok("get"))
						.route("POST", "/b", () => ok("post")),
				);

				const get = await server.fetch("/a");
				const result = await server.fetch("/a", { method: "POST" });

				expect(get.status).toBe(200);
				expect(result.status).toBe(404);
			});

			it("should not implicitly answer HEAD or OPTIONS from a GET route", async () => {
				using server = serveApp(
					new Module().route("GET", "/a", () => ok("get")),
				);

				const get = await server.fetch("/a");
				const head = await server.fetch("/a", { method: "HEAD" });
				const options = await server.fetch("/a", { method: "OPTIONS" });

				expect(get.status).toBe(200);
				expect(head.status).toBe(404);
				expect(options.status).toBe(404);
			});
		});

		describe("non-canonical verbs", () => {
			it("should dispatch a custom verb route declared on a regexp-only path", async () => {
				using server = serveApp(
					new Module().route("PURGE", "/a/...r1", () => ok("purge")),
				);

				const purge = await server.fetch("/a/b", { method: "PURGE" });
				const get = await server.fetch("/a/b");

				expect(purge.status).toBe(200);
				expect(await purge.text()).toBe("purge");
				expect(get.status).toBe(404);
			});

			it("should throw on listen when a custom verb is declared on a static path", () => {
				expect(() =>
					serveApp(
						new Module().route("PURGE", "/a", () => ok("purge")),
					),
				).toThrow(TypeError);
			});

			it("should throw on listen when a lowercase method is declared on a static path", () => {
				expect(() =>
					serveApp(new Module().route("get", "/a", () => ok("get"))),
				).toThrow(TypeError);
			});

			it("should never match a lowercase method declared on a regexp-only path", async () => {
				using server = serveApp(
					new Module().route("get", "/a/...r1", () => ok("get")),
				);

				const result = await server.fetch("/a/b");

				expect(result.status).toBe(404);
			});
		});
	});

	describe("params", () => {
		it("should match exactly one segment with a required param", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1", () => ok("v1")),
			);

			const result = await server.fetch("/a/1");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should 404 when the param segment is missing", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1", () => ok("v1")),
			);

			const hit = await server.fetch("/a/1");
			const bare = await server.fetch("/a");
			const trailing = await server.fetch("/a/");

			expect(hit.status).toBe(200);
			expect(bare.status).toBe(404);
			expect(trailing.status).toBe(404);
		});

		it("should not let a param span multiple segments", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1", () => ok("v1")),
			);

			const single = await server.fetch("/a/1");
			const spanning = await server.fetch("/a/1/2");

			expect(single.status).toBe(200);
			expect(spanning.status).toBe(404);
		});

		it("should match multiple params separated by literal segments", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1/b/:p2", () => ok("v1")),
			);

			const hit = await server.fetch("/a/1/b/2");
			const miss = await server.fetch("/a/1/c/2");

			expect(hit.status).toBe(200);
			expect(await hit.text()).toBe("v1");
			expect(miss.status).toBe(404);
		});

		it("should match URL-encoded characters inside a param segment", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1", () => ok("v1")),
			);

			const result = await server.fetch("/a/1%202");

			expect(result.status).toBe(200);
		});

		it("should match an optional param with and without the segment", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1?", () => ok("v1")),
			);

			const without = await server.fetch("/a");
			const withSegment = await server.fetch("/a/1");
			const extra = await server.fetch("/a/1/2");

			expect(without.status).toBe(200);
			expect(withSegment.status).toBe(200);
			expect(extra.status).toBe(404);
		});

		it("should not expose URL params on the context yet (migration gap)", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1", (context) =>
					ok(typeof context.request.params),
				),
			);

			const result = await server.fetch("/a/1");

			expect(await result.text()).toBe("undefined");
		});
	});

	describe("rest", () => {
		it("should match a single segment with a rest param", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/...r1", () => ok("v1")),
			);

			const result = await server.fetch("/a/1");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should match multiple segments with a rest param", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/...r1", () => ok("v1")),
			);

			const result = await server.fetch("/a/1/2/3");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should 404 the bare prefix of a rest param route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/...r1", () => ok("v1")),
			);

			const hit = await server.fetch("/a/1");
			const bare = await server.fetch("/a");

			expect(hit.status).toBe(200);
			expect(bare.status).toBe(404);
		});

		it("should match the bare prefix when the rest param is optional", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/...r1?", () => ok("v1")),
			);

			const bare = await server.fetch("/a");
			const deep = await server.fetch("/a/1/2");

			expect(bare.status).toBe(200);
			expect(deep.status).toBe(200);
		});
	});

	describe("wildcard", () => {
		it("should match a single segment with a wildcard", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/*", () => ok("v1")),
			);

			const result = await server.fetch("/a/1");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should match multiple segments with a wildcard", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/*", () => ok("v1")),
			);

			const result = await server.fetch("/a/1/2");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should 404 the bare prefix of a wildcard route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/*", () => ok("v1")),
			);

			const hit = await server.fetch("/a/1");
			const bare = await server.fetch("/a");

			expect(hit.status).toBe(200);
			expect(bare.status).toBe(404);
		});

		it("should match the bare prefix with a trailing slash on a wildcard route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/*", () => ok("v1")),
			);

			const result = await server.fetch("/a/");

			expect(result.status).toBe(200);
		});
	});

	describe("precedence", () => {
		it("should prefer a static route over a param route for its literal segment", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a/:p1", () => ok("param"))
					.route("GET", "/a/b", () => ok("static")),
			);

			const literal = await server.fetch("/a/b");
			const dynamic = await server.fetch("/a/1");

			expect(await literal.text()).toBe("static");
			expect(await dynamic.text()).toBe("param");
		});

		it("should prefer a param route over a rest route for single-segment paths", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a/...r1", () => ok("rest"))
					.route("GET", "/a/:p1", () => ok("param")),
			);

			const single = await server.fetch("/a/1");
			const deep = await server.fetch("/a/1/2");

			expect(await single.text()).toBe("param");
			expect(await deep.text()).toBe("rest");
		});

		it("should pick the first-registered among overlapping regexp-only routes", async () => {
			using restFirst = serveApp(
				new Module()
					.route("GET", "/a/...r1", () => ok("rest"))
					.route("GET", "/a/:p1?", () => ok("optional")),
			);
			using optionalFirst = serveApp(
				new Module()
					.route("GET", "/a/:p1?", () => ok("optional"))
					.route("GET", "/a/...r1", () => ok("rest")),
			);

			const rest = await restFirst.fetch("/a/1");
			const optional = await optionalFirst.fetch("/a/1");

			expect(await rest.text()).toBe("rest");
			expect(await optional.text()).toBe("optional");
		});

		it("should pick the first-registered among duplicate static routes", async () => {
			const module = new Module()
				.route("GET", "/a", () => ok("first"))
				.route("GET", "/a", () => ok("second"));

			expectTypeOf<
				Extract<
					(typeof module)["routes"]["a"]["get"]["response"],
					{ success: true }
				>["content"]
			>().toEqualTypeOf<"first">();

			using server = serveApp(module);

			const served = await server.fetch("/a");
			const fallback = await server.app.fetch(
				new Request(server.url("/a")),
			);

			expect(await served.text()).toBe("first");
			expect(await fallback.text()).toBe("first");
		});
	});

	describe("prefixes", () => {
		it("should serve routes under the module prefix", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).route("GET", "/a", () =>
					ok("v1"),
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should serve a root route at the prefix itself", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).route("GET", "/", () => ok("v1")),
			);

			const exact = await server.fetch("/v1");
			const trailing = await server.fetch("/v1/");

			expect(exact.status).toBe(200);
			expect(await exact.text()).toBe("v1");
			expect(trailing.status).toBe(404);
		});
	});
});
