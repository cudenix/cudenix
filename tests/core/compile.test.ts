import { describe, expect, test } from "bun:test";

import { Cudenix } from "@/core/cudenix";
import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

describe("compile", () => {
	describe("static responses", () => {
		test("should register a value-handler route with an empty chain as a pre-built Response", () => {
			const app = new Cudenix(new Module().route("GET", "/a", ok("v1")));

			app.compile();

			expect(app.routes["/a"]?.GET).toBeInstanceOf(Response);
		});

		test("should register a root-path static route as a pre-built Response", () => {
			const app = new Cudenix(new Module().route("GET", "/", ok("v1")));

			app.compile();

			expect(app.routes["/"]?.GET).toBeInstanceOf(Response);
		});

		test("should carry the envelope status and text body into the pre-built Response", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", ok("v1", { status: 201 })),
			);

			app.compile();

			const result = app.routes["/a"]?.GET as Response;

			expect(result.status).toBe(201);
			expect(await result.text()).toBe("v1");
		});

		test("should JSON-encode an object envelope into the pre-built Response", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", ok({ a: "v1" })),
			);

			app.compile();

			const result = app.routes["/a"]?.GET as Response;

			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual({ a: "v1" });
		});

		test("should carry a fail envelope status into the pre-built Response", () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", fail("v1", { status: 404 })),
			);

			app.compile();

			expect((app.routes["/a"]?.GET as Response).status).toBe(404);
		});

		test("should build a 204 Response for an empty-content envelope", () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", ok(undefined)),
			);

			app.compile();

			expect((app.routes["/a"]?.GET as Response).status).toBe(204);
		});
	});

	describe("dispatch fallback", () => {
		test("should register a function-handler route as a dispatch handler", () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			app.compile();

			expect(app.routes["/a"]?.GET).toBeTypeOf("function");
		});

		test("should keep a static route behind a middleware as a dispatch handler", () => {
			const app = new Cudenix(
				new Module()
					.middleware(async (_, next) => {
						await next();
					})
					.route("GET", "/a", ok("v1")),
			);

			app.compile();

			expect(app.routes["/a"]?.GET).toBeTypeOf("function");
		});

		test("should keep a static route behind a store as a dispatch handler", () => {
			const app = new Cudenix(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", ok("v1")),
			);

			app.compile();

			expect(app.routes["/a"]?.GET).toBeTypeOf("function");
		});
	});

	describe("dual registration", () => {
		test('should tag a pre-built static endpoint with `router: "bun"`', () => {
			const app = new Cudenix(new Module().route("GET", "/a", ok("v1")));

			app.compile();

			expect(app.methods.GET?.endpoints[0]?.router).toBe("bun");
		});

		test("should still resolve a static route through `fetch`", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", ok("v1", { status: 201 })),
			);

			app.compile();

			const result = await app.fetch(new Request("http://localhost/a"));

			expect(result.status).toBe(201);
			expect(await result.text()).toBe("v1");
		});
	});
});
