import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › nesting", () => {
	describe("a module prefix", () => {
		test("should serve routes under the prefix", async () => {
			const app = buildApp(
				new Module({ prefix: "/v1" }).route("GET", "/a", () =>
					ok("hit"),
				),
			);

			const result = await app.fetch(req("/v1/a"));

			expect(result.status).toBe(200);
		});

		test("should 404 the unprefixed path", async () => {
			const app = buildApp(
				new Module({ prefix: "/v1" }).route("GET", "/a", () =>
					ok("hit"),
				),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(404);
		});
	});

	describe("a group", () => {
		test("should serve routes under the merged group prefix", async () => {
			const app = buildApp(
				new Module().group(
					(module) => module.route("GET", "/g", () => ok("hit")),
					{ prefix: "/grp" },
				),
			);

			const result = await app.fetch(req("/grp/g"));

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
						(module) => module.route("GET", "/g", () => ok("hit")),
						{ prefix: "/grp" },
					),
			);

			await app.fetch(req("/grp/g"));

			expect(seen).toEqual(["mw"]);
		});
	});

	describe("a mounted module", () => {
		test("should nest the mounted routes under the parent prefix", async () => {
			const app = buildApp(
				new Module({ prefix: "/v1" }).mount(
					new Module().route("GET", "/m", () => ok("hit")),
				),
			);

			const result = await app.fetch(req("/v1/m"));

			expect(result.status).toBe(200);
		});
	});
});
