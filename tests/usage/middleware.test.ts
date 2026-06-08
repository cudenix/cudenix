import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { buildApp, req } from "./helpers";

describe("usage: middleware", () => {
	describe("execution order", () => {
		test("should wrap the handler in onion order", async () => {
			const order: string[] = [];

			const app = buildApp(
				new Module()
					.middleware(async (_, next) => {
						order.push("a:in");

						await next();

						order.push("a:out");
					})
					.middleware(async (_, next) => {
						order.push("b:in");

						await next();

						order.push("b:out");
					})
					.route("GET", "/a", () => {
						order.push("handler");

						return ok("v1");
					}),
			);

			await app.fetch(req("/a"));

			expect(order).toEqual([
				"a:in",
				"b:in",
				"handler",
				"b:out",
				"a:out",
			]);
		});
	});

	describe("short-circuit", () => {
		test("should skip the handler when a middleware returns without calling next", async () => {
			let handlerRan = false;

			const app = buildApp(
				new Module()
					.middleware(() => fail("blocked", { status: 401 }))
					.route("GET", "/a", () => {
						handlerRan = true;

						return ok("v1");
					}),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(401);
			expect(await result.text()).toBe("blocked");
			expect(handlerRan).toBe(false);
		});
	});

	describe("response override", () => {
		test("should override the handler response when a middleware returns after next", async () => {
			const app = buildApp(
				new Module()
					.middleware(async (_, next) => {
						await next();

						return ok("override");
					})
					.route("GET", "/a", () => ok("original")),
			);

			const result = await app.fetch(req("/a"));

			expect(await result.text()).toBe("override");
		});
	});

	describe("pass-through", () => {
		test("should keep the handler response when a middleware returns nothing", async () => {
			const app = buildApp(
				new Module()
					.middleware(async (_, next) => {
						await next();
					})
					.route("GET", "/a", () => ok("original")),
			);

			const result = await app.fetch(req("/a"));

			expect(await result.text()).toBe("original");
		});
	});
});
