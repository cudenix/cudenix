import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › multiple routes", () => {
	describe("disambiguation", () => {
		test("should dispatch each route to its own handler", async () => {
			const app = buildApp(
				new Module()
					.route("GET", "/a", () => ok("a"))
					.route("GET", "/b", () => ok("b"))
					.route("GET", "/c/:p1", () => ok("c")),
			);

			const a = await app.fetch(req("/a"));
			const b = await app.fetch(req("/b"));
			const c = await app.fetch(req("/c/v1"));

			expect(await a.text()).toBe("a");
			expect(await b.text()).toBe("b");
			expect(await c.text()).toBe("c");
		});
	});

	describe("precedence", () => {
		test("should not let a static route match a longer path sharing its prefix", async () => {
			const app = buildApp(
				new Module()
					.route("GET", "/a", () => ok("a"))
					.route("GET", "/ab", () => ok("ab")),
			);

			const a = await app.fetch(req("/a"));
			const ab = await app.fetch(req("/ab"));

			expect(await a.text()).toBe("a");
			expect(await ab.text()).toBe("ab");
		});

		test("should resolve overlapping routes in registration order, not by specificity", async () => {
			// No static-over-dynamic preference: whichever overlapping route is
			// registered first claims the match.
			const staticFirst = buildApp(
				new Module()
					.route("GET", "/a/b", () => ok("static"))
					.route("GET", "/a/:p1", () => ok("param")),
			);
			const paramFirst = buildApp(
				new Module()
					.route("GET", "/a/:p1", () => ok("param"))
					.route("GET", "/a/b", () => ok("static")),
			);

			const staticResult = await staticFirst.fetch(req("/a/b"));
			const paramResult = await paramFirst.fetch(req("/a/b"));

			expect(await staticResult.text()).toBe("static");
			expect(await paramResult.text()).toBe("param");
		});
	});

	describe("combined segments", () => {
		test("should match a path combining a parameter and a rest segment", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1/b/...r1", () => ok("hit")),
			);

			const result = await app.fetch(req("/a/v1/b/v2/v3"));

			expect(result.status).toBe(200);
		});

		test("should 404 when the trailing rest segment is missing", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1/b/...r1", () => ok("hit")),
			);

			const result = await app.fetch(req("/a/v1/b"));

			expect(result.status).toBe(404);
		});
	});
});
