import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › wildcard", () => {
	test("should match multiple trailing segments", async () => {
		const app = buildApp(
			new Module().route("GET", "/a/*", () => ok("hit")),
		);

		const result = await app.fetch(req("/a/v1/v2"));

		expect(result.status).toBe(200);
	});

	test("should match a single trailing segment", async () => {
		const app = buildApp(
			new Module().route("GET", "/a/*", () => ok("hit")),
		);

		const result = await app.fetch(req("/a/v1"));

		expect(result.status).toBe(200);
	});

	test("should 404 when there is no segment to match", async () => {
		const app = buildApp(
			new Module().route("GET", "/a/*", () => ok("hit")),
		);

		const result = await app.fetch(req("/a"));

		expect(result.status).toBe(404);
	});
});
