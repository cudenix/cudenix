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
					.route("GET", "/users/:id", () => ok("user")),
			);

			const a = await app.fetch(req("/a"));
			const b = await app.fetch(req("/b"));
			const user = await app.fetch(req("/users/5"));

			expect(await a.text()).toBe("a");
			expect(await b.text()).toBe("b");
			expect(await user.text()).toBe("user");
		});
	});

	describe("combined segments", () => {
		test("should match a path combining a parameter and a rest segment", async () => {
			const app = buildApp(
				new Module().route("GET", "/users/:id/files/...path", () =>
					ok("hit"),
				),
			);

			const result = await app.fetch(req("/users/5/files/a/b"));

			expect(result.status).toBe(200);
		});

		test("should 404 when the trailing rest segment is missing", async () => {
			const app = buildApp(
				new Module().route("GET", "/users/:id/files/...path", () =>
					ok("hit"),
				),
			);

			const result = await app.fetch(req("/users/5/files"));

			expect(result.status).toBe(404);
		});
	});
});
