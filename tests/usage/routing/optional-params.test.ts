import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › optional params", () => {
	test("should match when the optional segment is present", async () => {
		const app = buildApp(
			new Module().route("GET", "/a/:p1?", () => ok("hit")),
		);

		const result = await app.fetch(req("/a/v1"));

		expect(result.status).toBe(200);
	});

	test("should match when the optional segment is absent", async () => {
		const app = buildApp(
			new Module().route("GET", "/a/:p1?", () => ok("hit")),
		);

		const result = await app.fetch(req("/a"));

		expect(result.status).toBe(200);
	});

	test("should 404 when a non-optional later segment breaks the pattern", async () => {
		const app = buildApp(
			new Module().route("GET", "/a/:p1?", () => ok("hit")),
		);

		const result = await app.fetch(req("/a/v1/extra"));

		expect(result.status).toBe(404);
	});
});
