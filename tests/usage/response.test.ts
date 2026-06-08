import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { buildApp, req } from "./helpers";

describe("usage: response mapping", () => {
	describe("ok envelopes", () => {
		test("should serialize an object payload as JSON with status 200", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () => ok({ a: "v1" })),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual({ a: "v1" });
		});

		test("should serialize an array payload as JSON", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () => ok(["v1", "v2"])),
			);

			const result = await app.fetch(req("/a"));

			expect(await result.json()).toEqual(["v1", "v2"]);
		});

		test("should serialize a string payload as a raw body", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		test("should carry a custom status", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () =>
					ok("v1", { status: 201 }),
				),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(201);
		});

		test("should return 204 for empty content", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () => ok(undefined)),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
		});

		test("should pass a Response payload through with its own status", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () =>
					ok(new Response("x", { status: 418 })),
				),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(418);
			expect(await result.text()).toBe("x");
		});
	});

	describe("fail envelopes", () => {
		test("should default to status 400", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () => fail("bad")),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(400);
			expect(await result.text()).toBe("bad");
		});

		test("should carry a custom status", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () =>
					fail("nope", { status: 401 }),
				),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(401);
		});
	});

	describe("current runtime", () => {
		test("should return 204 for null content", async () => {
			const app = buildApp(
				new Module().route("GET", "/a", () => ok(null)),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(204);
		});

		test("should ignore response headers set on the context", async () => {
			// response() serializes only context.response.content; headers and
			// cookies set on the context are dropped. Update once the response
			// wiring lands.
			const app = buildApp(
				new Module()
					.middleware((context, next) => {
						(
							context.response as unknown as {
								headers: Record<string, string>;
							}
						).headers["x-test"] = "v1";

						return next();
					})
					.route("GET", "/a", () => ok("hi")),
			);

			const result = await app.fetch(req("/a"));

			expect(result.headers.get("x-test")).toBeNull();
		});
	});
});
