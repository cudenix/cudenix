import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › no params", () => {
	test("should resolve a static path to its handler", async () => {
		const app = buildApp(
			new Module().route("GET", "/health", () => ok("ok")),
		);

		const result = await app.fetch(req("/health"));

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("ok");
	});

	test("should resolve the root path", async () => {
		const app = buildApp(new Module().route("GET", "/", () => ok("root")));

		const result = await app.fetch(req("/"));

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("root");
	});

	test("should 404 an unknown path", async () => {
		const app = buildApp(
			new Module().route("GET", "/health", () => ok("ok")),
		);

		const result = await app.fetch(req("/missing"));

		expect(result.status).toBe(404);
	});
});
