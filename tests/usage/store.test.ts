import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { buildApp, req } from "./helpers";

describe("usage: store", () => {
	describe("propagation", () => {
		test("should expose a store record to the route handler", async () => {
			const app = buildApp(
				new Module()
					.store(() => ({ user: "ann" }))
					.route("GET", "/a", (context) =>
						ok({ user: context.store.user }),
					),
			);

			const result = await app.fetch(req("/a"));

			expect(await result.json()).toEqual({ user: "ann" });
		});

		test("should accumulate records across multiple stores", async () => {
			const app = buildApp(
				new Module()
					.store(() => ({ a: 1 }))
					.store((context) => ({ b: context.store.a + 1 }))
					.route("GET", "/a", (context) =>
						ok({ a: context.store.a, b: context.store.b }),
					),
			);

			const result = await app.fetch(req("/a"));

			expect(await result.json()).toEqual({ a: 1, b: 2 });
		});
	});

	describe("short-circuit", () => {
		test("should halt the chain when a store returns a fail", async () => {
			let handlerRan = false;

			const app = buildApp(
				new Module()
					.store(() => fail("forbidden", { status: 403 }))
					.route("GET", "/a", () => {
						handlerRan = true;

						return ok("v1");
					}),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(403);
			expect(await result.text()).toBe("forbidden");
			expect(handlerRan).toBe(false);
		});
	});

	describe("per request", () => {
		test("should run stores fresh on every request", async () => {
			let calls = 0;

			const app = buildApp(
				new Module()
					.store(() => {
						calls++;

						return { calls };
					})
					.route("GET", "/a", (context) =>
						ok({ calls: context.store.calls }),
					),
			);

			const first = await app.fetch(req("/a"));
			const second = await app.fetch(req("/a"));

			expect(await first.json()).toEqual({ calls: 1 });
			expect(await second.json()).toEqual({ calls: 2 });
		});
	});
});
