import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import { tryCatch } from "@/ecosystem/plugins/try-catch/try-catch";

import { buildApp, req } from "../helpers";

// tryCatch() returns a Module whose middleware wraps the routes chained after
// it, turning a thrown handler error into a 500 response.
describe("usage: plugins › tryCatch", () => {
	test("should convert a thrown error into a 500 response", async () => {
		const app = buildApp(
			new Module().mount(tryCatch()).route("GET", "/a", () => {
				throw new Error("boom");
			}),
		);

		const result = await app.fetch(req("/a"));

		expect(result.status).toBe(500);
	});

	test("should pass through when the handler does not throw", async () => {
		const app = buildApp(
			new Module().mount(tryCatch()).route("GET", "/a", () => ok("fine")),
		);

		const result = await app.fetch(req("/a"));

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("fine");
	});
});
