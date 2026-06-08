import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "./helpers";

describe("usage: handlers", () => {
	test("should resolve an async handler", async () => {
		const app = buildApp(
			new Module().route("GET", "/a", async () => {
				await Promise.resolve();

				return ok("async");
			}),
		);

		const result = await app.fetch(req("/a"));

		expect(await result.text()).toBe("async");
	});

	test("should accept a static envelope handler", async () => {
		const app = buildApp(new Module().route("GET", "/a", ok("static")));

		const result = await app.fetch(req("/a"));

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("static");
	});

	test("should treat a static and a function handler identically", async () => {
		const fnApp = buildApp(new Module().route("GET", "/a", () => ok("v1")));
		const valueApp = buildApp(new Module().route("GET", "/a", ok("v1")));

		const fnResult = await fnApp.fetch(req("/a"));
		const valueResult = await valueApp.fetch(req("/a"));

		expect(await fnResult.text()).toBe(await valueResult.text());
	});
});
