import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › optional rest", () => {
	test("should match multiple trailing segments", async () => {
		const app = buildApp(
			new Module().route("GET", "/files/...path?", () => ok("hit")),
		);

		const result = await app.fetch(req("/files/a/b/c"));

		expect(result.status).toBe(200);
	});

	test("should match a single trailing segment", async () => {
		const app = buildApp(
			new Module().route("GET", "/files/...path?", () => ok("hit")),
		);

		const result = await app.fetch(req("/files/a"));

		expect(result.status).toBe(200);
	});

	test("should match when no trailing segment is present", async () => {
		const app = buildApp(
			new Module().route("GET", "/files/...path?", () => ok("hit")),
		);

		const result = await app.fetch(req("/files"));

		expect(result.status).toBe(200);
	});
});
