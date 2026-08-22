import { describe, expect, expectTypeOf, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import { client, type InferRouteOptions } from "@/ecosystem/client/client";

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

		it("should ignore a URL fragment when matching a path", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const result = await server.app.fetch(
				new Request(`${server.url("/a")}#frag`),
			);

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

			it("should answer HEAD from a GET route without content, but not OPTIONS", async () => {
				using server = serveApp(
					new Module().route("GET", "/a", () => ok("get")),
				);

				const get = await server.fetch("/a");
				const head = await server.fetch("/a", { method: "HEAD" });
				const options = await server.fetch("/a", { method: "OPTIONS" });

				expect(get.status).toBe(200);
				expect(head.status).toBe(200);
				expect(await head.text()).toBe("");
				expect(options.status).toBe(404);
			});

			it("should answer HEAD identically for native and fallback routes", async () => {
				using server = serveApp(
					new Module()
						.route("GET", "/native", () => ok("v1"))
						// a rest parameter keeps this off Bun's native router
						.route("GET", "/fallback/...rest", () => ok("v2")),
				);

				const native = await server.fetch("/native", {
					method: "HEAD",
				});
				const fallback = await server.fetch("/fallback/a/b", {
					method: "HEAD",
				});

				expect(native.status).toBe(200);
				expect(fallback.status).toBe(200);
				expect(await native.text()).toBe("");
				expect(await fallback.text()).toBe("");
			});

			it("should prefer a declared HEAD route over the one derived from GET", async () => {
				using server = serveApp(
					new Module()
						.route("GET", "/a", () => ok("get"))
						.route("HEAD", "/a", () => ok(null, { status: 204 })),
				);

				const result = await server.fetch("/a", { method: "HEAD" });

				expect(result.status).toBe(204);
			});
		});

		describe("query", () => {
			it("should serve a QUERY route through the regexp fallback", async () => {
				using server = serveApp(
					new Module().route("QUERY", "/a", () => ok("query")),
				);

				const result = await server.fetch("/a", {
					body: "b1",
					method: "QUERY",
				});

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("query");
				expect(server.app.routes["/a"]).toBeUndefined();
			});

			it("should expose the QUERY content to the handler", async () => {
				using server = serveApp(
					new Module().route("QUERY", "/a", async (context) =>
						ok(await context.request.raw.text()),
					),
				);

				const result = await server.fetch("/a", {
					body: "b1",
					method: "QUERY",
				});

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("b1");
			});

			it("should route by method when GET and QUERY share a path", async () => {
				using server = serveApp(
					new Module()
						.route("GET", "/a", () => ok("get"))
						.route("QUERY", "/a", () => ok("query")),
				);

				const get = await server.fetch("/a");
				const query = await server.fetch("/a", {
					body: "b1",
					method: "QUERY",
				});

				expect(await get.text()).toBe("get");
				expect(await query.text()).toBe("query");
			});

			it("should match params on a QUERY route", async () => {
				using server = serveApp(
					new Module().route("QUERY", "/a/:p1", (context) =>
						ok(context.request.params.p1),
					),
				);

				const result = await server.fetch("/a/b", {
					body: "b1",
					method: "QUERY",
				});

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("b");
			});

			it("should not implicitly answer QUERY from a GET route", async () => {
				using server = serveApp(
					new Module().route("GET", "/a", () => ok("get")),
				);

				const get = await server.fetch("/a");
				const query = await server.fetch("/a", {
					body: "b1",
					method: "QUERY",
				});

				expect(get.status).toBe(200);
				expect(query.status).toBe(404);
			});

			it("should expose a QUERY route to clients under its lowercase key", () => {
				const module = new Module().route("QUERY", "/a", () =>
					ok("v1"),
				);
				const api = client<typeof module>({ url: "http://localhost" });

				expectTypeOf<
					(typeof module)["routes"]["a"]["query"]["method"]
				>().toEqualTypeOf<"QUERY">();
				expectTypeOf(api.a.query).toBeFunction();
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

			it("should serve a custom verb on a static path through the regexp fallback", async () => {
				using server = serveApp(
					new Module().route("PURGE", "/a", () => ok("purge")),
				);

				const result = await server.fetch("/a", { method: "PURGE" });

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("purge");
				expect(server.app.routes["/a"]).toBeUndefined();
			});

			it("should normalize a lowercase method into Bun's table", async () => {
				using server = serveApp(
					new Module().route("get", "/a", () => ok("get")),
				);

				const result = await server.fetch("/a");

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("get");
				expect(server.app.routes["/a"]).toBeDefined();
			});

			it("should normalize a lowercase method declared on a regexp-only path", async () => {
				using server = serveApp(
					new Module().route("get", "/a/...r1", () => ok("get")),
				);

				const result = await server.fetch("/a/b");

				expect(result.status).toBe(200);
				expect(await result.text()).toBe("get");
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

		it("should keep an all-optional param visible to handlers and optional to clients", () => {
			const module = new Module().route(
				"GET",
				"/optional-only/:value?",
				(context) => {
					expectTypeOf(context.request.params).branded.toEqualTypeOf<{
						value?: string | undefined;
					}>();

					return ok("v1");
				},
			);
			const api = client<typeof module>({ url: "http://localhost" });

			type Options = InferRouteOptions<
				(typeof api)["optional-only"][":value?"]["get"]
			>;

			expectTypeOf<Options>().toHaveProperty("params");
			expectTypeOf<NonNullable<unknown>>().toExtend<Options>();
			expectTypeOf<{ params: undefined }>().toExtend<Options>();
			expectTypeOf<{
				params: NonNullable<unknown>;
			}>().toExtend<Options>();
			expectTypeOf<{ params: { value: string } }>().toExtend<Options>();
		});

		it("should type optional params like their runtime shape for handlers and clients", () => {
			const module = new Module().route(
				"GET",
				"/typed/:required/:optional?",
				(context) => {
					expectTypeOf(context.request.params).branded.toEqualTypeOf<{
						required: string;
						optional?: string | undefined;
					}>();

					return ok("v1");
				},
			);
			const api = client<typeof module>({ url: "http://localhost" });

			type Options = InferRouteOptions<
				(typeof api)["typed"][":required"][":optional?"]["get"]
			>;

			expectTypeOf<{
				params: { required: string };
			}>().toExtend<Options>();
			expectTypeOf<{
				params: { optional: undefined; required: string };
			}>().toExtend<Options>();
			expectTypeOf<NonNullable<unknown>>().not.toExtend<Options>();
		});

		it("should answer the root path when the only segment is an optional param", async () => {
			using server = serveApp(
				new Module().route("GET", "/:p1?", () => ok("v1")),
			);

			const root = await server.fetch("/");
			const withSegment = await server.fetch("/1");

			expect(root.status).toBe(200);
			expect(withSegment.status).toBe(200);
		});

		it("should expose URL params on the context without a validator", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1", (context) =>
					ok(context.request.params),
				),
			);

			const result = await server.fetch("/a/1");

			expect(await result.json()).toEqual({ p1: "1" });
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

		it("should answer the trailing-slash bare prefix identically through Bun's table and the regexp fallback", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/*", () => ok("v1")),
			);

			const served = await server.fetch("/a/");
			const fallback = await server.app.fetch(
				new Request(server.url("/a/")),
			);

			expect(served.status).toBe(200);
			expect(fallback.status).toBe(200);
		});
	});

	describe("mixed segments", () => {
		it("should match a rest param followed by a trailing literal segment", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/...r1/b", () => ok("v1")),
			);

			const single = await server.fetch("/a/1/b");
			const deep = await server.fetch("/a/1/2/b");
			const ignoresQuery = await server.fetch("/a/1/b?x=1");
			const bare = await server.fetch("/a/b");
			const overshoot = await server.fetch("/a/1/b/c");

			expect(single.status).toBe(200);
			expect(deep.status).toBe(200);
			expect(ignoresQuery.status).toBe(200);
			expect(bare.status).toBe(404);
			expect(overshoot.status).toBe(404);
		});

		it("should match a param segment followed by a rest segment", async () => {
			using server = serveApp(
				new Module().route("GET", "/a/:p1/...r2", () => ok("v1")),
			);

			const single = await server.fetch("/a/1/2");
			const deep = await server.fetch("/a/1/2/3");
			const missingRest = await server.fetch("/a/1");
			const bare = await server.fetch("/a");

			expect(single.status).toBe(200);
			expect(deep.status).toBe(200);
			expect(missingRest.status).toBe(404);
			expect(bare.status).toBe(404);
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

		it("should prefer a static route over a wildcard regardless of registration order", async () => {
			using wildFirst = serveApp(
				new Module()
					.route("GET", "/a/*", () => ok("wild"))
					.route("GET", "/a/b", () => ok("static")),
			);
			using staticFirst = serveApp(
				new Module()
					.route("GET", "/a/b", () => ok("static"))
					.route("GET", "/a/*", () => ok("wild")),
			);

			expect(await (await wildFirst.fetch("/a/b")).text()).toBe("static");
			expect(await (await staticFirst.fetch("/a/b")).text()).toBe(
				"static",
			);
			expect(await (await wildFirst.fetch("/a/c")).text()).toBe("wild");
		});

		it("should prefer a param route over a wildcard for a single segment regardless of registration order", async () => {
			using paramFirst = serveApp(
				new Module()
					.route("GET", "/a/:p1", () => ok("param"))
					.route("GET", "/a/*", () => ok("wild")),
			);
			using wildFirst = serveApp(
				new Module()
					.route("GET", "/a/*", () => ok("wild"))
					.route("GET", "/a/:p1", () => ok("param")),
			);

			expect(await (await paramFirst.fetch("/a/1")).text()).toBe("param");
			expect(await (await wildFirst.fetch("/a/1")).text()).toBe("param");

			const multi = await paramFirst.fetch("/a/1/2");

			expect(multi.status).toBe(200);
			expect(await multi.text()).toBe("wild");
		});

		it("should prefer a static route over an earlier-registered param route identically through Bun's table and the regexp fallback", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a/:p1", () => ok("param"))
					.route("GET", "/a/b", () => ok("static")),
			);

			const served = await server.fetch("/a/b");
			const fallback = await server.app.fetch(
				new Request(server.url("/a/b")),
			);

			expect(await served.text()).toBe("static");
			expect(await fallback.text()).toBe("static");
		});

		it("should prefer a param route over an earlier-registered rest route identically through both dispatch paths", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a/...r1", () => ok("rest"))
					.route("GET", "/a/:p1", () => ok("param")),
			);

			const served = await server.fetch("/a/1");
			const fallback = await server.app.fetch(
				new Request(server.url("/a/1")),
			);

			expect(await served.text()).toBe("param");
			expect(await fallback.text()).toBe("param");
		});

		it("should order static, param, and wildcard routes by specificity through the regexp fallback", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a/*", () => ok("wild"))
					.route("GET", "/a/:p1", () => ok("param"))
					.route("GET", "/a/b", () => ok("static")),
			);

			const staticFallback = await server.app.fetch(
				new Request(server.url("/a/b")),
			);
			const paramFallback = await server.app.fetch(
				new Request(server.url("/a/1")),
			);
			const wildFallback = await server.app.fetch(
				new Request(server.url("/a/1/2")),
			);

			expect(await staticFallback.text()).toBe("static");
			expect(await paramFallback.text()).toBe("param");
			expect(await wildFallback.text()).toBe("wild");
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

	describe("capture layout", () => {
		// the marker capture closes each pattern, so a route's parameters sit at
		// matchOffset..matchOffset+n-1 and its marker at matchOffset+n. Getting
		// that bookkeeping wrong silently routes a request to a sibling.
		it("should route every endpoint of a large mixed table to its own handler", async () => {
			let module = new Module();

			const expected: [string, string][] = [];

			for (let i = 0; i < 60; i++) {
				const shape = i % 4;

				if (shape === 0) {
					module = module.route("GET", `/s${i}/leaf`, () =>
						ok(`static-${i}`),
					) as typeof module;

					expected.push([`/s${i}/leaf`, `static-${i}`]);

					continue;
				}

				if (shape === 1) {
					module = module.route("GET", `/p${i}/:a/:b`, (context) =>
						ok(
							`param-${i}-${context.request.params.a}-${context.request.params.b}`,
						),
					) as typeof module;

					expected.push([`/p${i}/x/y`, `param-${i}-x-y`]);

					continue;
				}

				if (shape === 2) {
					module = module.route("GET", `/r${i}/...rest`, (context) =>
						ok(
							`rest-${i}-${(context.request.params.rest as string[]).join("|")}`,
						),
					) as typeof module;

					expected.push([`/r${i}/x/y/z`, `rest-${i}-x|y|z`]);

					continue;
				}

				module = module.route("GET", `/o${i}/:a?`, (context) =>
					ok(`optional-${i}-${context.request.params.a ?? "none"}`),
				) as typeof module;

				expected.push([`/o${i}/v`, `optional-${i}-v`]);
				expected.push([`/o${i}`, `optional-${i}-none`]);
			}

			using server = serveApp(module);

			for (const [path, body] of expected) {
				const result = await server.fetch(path as `/${string}`);

				expect(result.status).toBe(200);
				expect(await result.text()).toBe(body);
			}

			const missing = await server.fetch("/wp-admin/setup-config.php");

			expect(missing.status).toBe(404);
		});

		it("should resolve params identically through Bun's table and the fallback", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/native/:a/:b", (context) =>
						ok(
							`${context.request.params.a}|${context.request.params.b}`,
						),
					)
					.route("GET", "/fallback/:a/...b", (context) =>
						ok(
							`${context.request.params.a}|${(context.request.params.b as string[]).join(",")}`,
						),
					),
			);

			const native = await server.fetch("/native/v1/v2");
			const fallback = await server.fetch("/fallback/v1/v2/v3");

			expect(await native.text()).toBe("v1|v2");
			expect(await fallback.text()).toBe("v1|v2,v3");
		});
	});
});
