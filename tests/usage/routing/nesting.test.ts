import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › nesting", () => {
	describe("a module prefix", () => {
		test("should serve routes under the prefix", async () => {
			const app = buildApp(
				new Module({ prefix: "/a" }).route("GET", "/b", () =>
					ok("hit"),
				),
			);

			const result = await app.fetch(req("/a/b"));

			expect(result.status).toBe(200);
		});

		test("should 404 the unprefixed path", async () => {
			const app = buildApp(
				new Module({ prefix: "/a" }).route("GET", "/b", () =>
					ok("hit"),
				),
			);

			const result = await app.fetch(req("/b"));

			expect(result.status).toBe(404);
		});
	});

	describe("a group", () => {
		test("should serve routes under the merged group prefix", async () => {
			const app = buildApp(
				new Module().group(
					(module) => module.route("GET", "/b", () => ok("hit")),
					{ prefix: "/a" },
				),
			);

			const result = await app.fetch(req("/a/b"));

			expect(result.status).toBe(200);
		});

		test("should not apply the group prefix to a sibling route", async () => {
			// A group scopes its prefix to its own routes; a route declared
			// after the group on the parent stays at the parent path.
			const app = buildApp(
				new Module()
					.group(
						(module) => module.route("GET", "/b", () => ok("hit")),
						{ prefix: "/a" },
					)
					.route("GET", "/c", () => ok("hit")),
			);

			const sibling = await app.fetch(req("/c"));
			const leaked = await app.fetch(req("/a/c"));

			expect(sibling.status).toBe(200);
			expect(leaked.status).toBe(404);
		});

		test("should merge a module prefix with a nested group prefix", async () => {
			const app = buildApp(
				new Module({ prefix: "/a" }).group(
					(module) => module.route("GET", "/c", () => ok("hit")),
					{ prefix: "/b" },
				),
			);

			const result = await app.fetch(req("/a/b/c"));

			expect(result.status).toBe(200);
		});

		test("should apply middleware declared before the group to its routes", async () => {
			const seen: string[] = [];

			const app = buildApp(
				new Module()
					.middleware(async (_, next) => {
						seen.push("mw");

						await next();
					})
					.group(
						(module) => module.route("GET", "/b", () => ok("hit")),
						{ prefix: "/a" },
					),
			);

			await app.fetch(req("/a/b"));

			expect(seen).toEqual(["mw"]);
		});
	});

	describe("a mounted module", () => {
		test("should nest the mounted routes under the parent prefix", async () => {
			const app = buildApp(
				new Module({ prefix: "/a" }).mount(
					new Module().route("GET", "/b", () => ok("hit")),
				),
			);

			const result = await app.fetch(req("/a/b"));

			expect(result.status).toBe(200);
		});
	});
});
