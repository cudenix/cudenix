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

	describe("unbuffered content", () => {
		test("should not pre-build a Response for a ReadableStream envelope", () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", ok(new ReadableStream())),
			);

			app.compile();

			expect(app.routes["/a"]?.GET).toBeTypeOf("function");
		});

		test("should not pre-build a Response for a Response envelope", () => {
			const app = new Cudenix(
				new Module().route(
					"GET",
					"/a",
					ok(Response.redirect("https://example.com", 302)),
				),
			);

			app.compile();

			expect(app.routes["/a"]?.GET).toBeTypeOf("function");
		});

		test("should boot and serve a static ReadableStream route through `listen`", async () => {
			const app = new Cudenix(
				new Module().route(
					"GET",
					"/a",
					ok(
						new ReadableStream({
							start(controller) {
								controller.enqueue(
									new TextEncoder().encode("v1"),
								);
								controller.close();
							},
						}),
					),
				),
			);

			app.listen({ port: 0 });

			const result = await fetch(
				`http://localhost:${app.server!.port}/a`,
			);

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");

			app.server!.stop(true);
		});

		test("should not pre-build a Response for an async-iterable envelope", () => {
			const app = new Cudenix(
				new Module().route(
					"GET",
					"/a",
					ok(
						(async function* () {
							yield new TextEncoder().encode("v1");
						})(),
					),
				),
			);

			app.compile();

			expect(app.routes["/a"]?.GET).toBeTypeOf("function");
		});

		test("should boot a static async-iterable route through `listen`", () => {
			const app = new Cudenix(
				new Module().route(
					"GET",
					"/a",
					ok(
						(async function* () {
							yield new TextEncoder().encode("v1");
						})(),
					),
				),
			);

			expect(() => app.listen({ port: 0 })).not.toThrow();

			app.server?.stop(true);
		});
	});

	describe("repeatable serving", () => {
		test("should serve a static Response envelope on every request", async () => {
			const app = new Cudenix(
				new Module().route(
					"GET",
					"/a",
					ok(new Response("v1", { status: 201 })),
				),
			);

			app.listen({ port: 0 });

			const url = `http://localhost:${app.server!.port}/a`;
			const first = await fetch(url);
			const second = await fetch(url);

			expect(first.status).toBe(201);
			expect(await first.text()).toBe("v1");
			expect(second.status).toBe(201);
			expect(await second.text()).toBe("v1");

			app.server!.stop(true);
		});

		test("should serve a static redirect envelope on every request", async () => {
			const app = new Cudenix(
				new Module().route(
					"GET",
					"/a",
					ok(Response.redirect("https://example.com/dest", 302)),
				),
			);

			app.listen({ port: 0 });

			const url = `http://localhost:${app.server!.port}/a`;
			const first = await fetch(url, { redirect: "manual" });
			const second = await fetch(url, { redirect: "manual" });

			expect(first.headers.get("location")).toBe(
				second.headers.get("location"),
			);
			expect(second.headers.get("location")).not.toBeNull();

			app.server!.stop(true);
		});
	});
});
