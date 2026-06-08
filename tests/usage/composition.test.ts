import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "./helpers";

// Middleware scope: a link applies to routes declared after it in the same
// module's chain, to routes pulled in by a later `.mount(...)`, and a mounted
// module's own middleware bubbles up so it also wraps the parent's routes
// declared after the mount (just like a directly-declared middleware).
describe("usage: composition", () => {
	test("should apply an outer middleware to routes from a mounted module", async () => {
		const seen: string[] = [];

		const app = buildApp(
			new Module()
				.middleware(async (_, next) => {
					seen.push("outer");

					await next();
				})
				.mount(new Module().route("GET", "/a", () => ok("hit"))),
		);

		await app.fetch(req("/a"));

		expect(seen).toEqual(["outer"]);
	});

	test("should bubble a mounted module's middleware to the parent's later routes", async () => {
		const seen: string[] = [];

		const app = buildApp(
			new Module()
				.mount(
					new Module()
						.middleware(async (_, next) => {
							seen.push("inner");

							await next();
						})
						.route("GET", "/inner", () => ok("inner")),
				)
				.route("GET", "/outer", () => ok("outer")),
		);

		const result = await app.fetch(req("/outer"));

		expect(await result.text()).toBe("outer");
		expect(seen).toEqual(["inner"]);
	});
});
