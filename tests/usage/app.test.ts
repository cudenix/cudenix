import { describe, expect, it } from "bun:test";

import { Cudenix, type Plugin } from "@/core/cudenix";
import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import type { ValidatorPlugin } from "@/core/validator";

import { serveApp } from "./helpers";

describe("usage: app", () => {
	describe("constructor", () => {
		it("should default jit to true when no options are given", () => {
			expect(new Cudenix(new Module()).jit).toBe(true);
		});

		it("should honor an explicit jit override", () => {
			expect(new Cudenix(new Module(), { jit: false }).jit).toBe(false);
		});
	});

	describe("plugins", () => {
		it("should expose a value a plugin stashed on memory to a handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) =>
					ok(context.memory.foo as string),
				),
				{
					plugins: [
						function (this: Cudenix) {
							this.memory.foo = "v1";
						},
					],
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should run multiple plugins once each, in registration order", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
				{
					plugins: [
						() => {
							events.push("first");
						},
						() => {
							events.push("second");
						},
					],
				},
			);

			await server.fetch("/a");
			await server.fetch("/a");

			expect(events).toEqual(["first", "second"]);
		});

		it("should accumulate plugins across separate .plugins() calls", () => {
			const events: string[] = [];

			const app = new Cudenix(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			app.plugins([
				() => {
					events.push("first");
				},
			]);
			app.plugins([
				() => {
					events.push("second");
				},
			]);

			app.compile();

			expect(events).toEqual(["first", "second"]);
		});
	});

	describe("memory", () => {
		it("should share memory across requests, unlike the per-request store", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.memory.n = ((context.memory.n as number) ?? 0) + 1;

					return ok(String(context.memory.n));
				}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("1");
			expect(await second.text()).toBe("2");
		});
	});

	describe("jit", () => {
		it("should serve identically when a route opts out of jit", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1"), { jit: false }),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});
	});

	describe("pipeline", () => {
		it("should thread a validated slot through a middleware, store, and handler in order", async () => {
			const withValidator = (validate: ValidatorPlugin): Plugin =>
				function (this: Cudenix) {
					this.memory.validator = validate;
				};

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						await next();
					})
					.validator({ request: { body: { v: "" } } })
					.store((context) => ({
						derived: `${context.request.body.v}:enriched`,
					}))
					.route("GET", "/a", (context) => ok(context.store.derived)),
				{
					plugins: [
						withValidator(() => ({
							content: { v: "parsed" },
							success: true,
						})),
					],
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("parsed:enriched");
		});
	});

	describe("listen", () => {
		it("should default development to false", () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			expect(server.app.server!.development).toBe(false);
		});

		it("should let options override a serve default", () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
				{ listen: { development: true } },
			);

			expect(server.app.server!.development).toBe(true);
		});
	});
});
