import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › wildcard", () => {
	test("should match any trailing segments", async () => {
		const app = buildApp(
			new Module().route("GET", "/assets/*", () => ok("hit")),
		);

		const result = await app.fetch(req("/assets/img/logo.png"));

		expect(result.status).toBe(200);
	});

	test("should 404 when there is no segment to match", async () => {
		const app = buildApp(
			new Module().route("GET", "/assets/*", () => ok("hit")),
		);

		const result = await app.fetch(req("/assets"));

		expect(result.status).toBe(404);
	});
});
