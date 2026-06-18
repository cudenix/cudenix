import { describe, expect, it } from "bun:test";

import { Cudenix, type Plugin } from "@/core/cudenix";
import { jit } from "@/core/jit";
import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";
import type { ValidatorPlugin } from "@/core/validator";

import { serveApp } from "./helpers";

const withValidator = (validate: ValidatorPlugin): Plugin =>
	function (this: Cudenix) {
		this.memory.validator = validate;
	};

describe("usage: jit", () => {
	describe("compilation", () => {
		it("should swap in a compiled dispatcher after the first request and reuse it", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			const cold = endpoint.dispatch;

			const first = await server.fetch("/a");

			const hot = endpoint.dispatch;

			expect(hot).not.toBe(cold);
			expect(await first.text()).toBe("v1");

			const second = await server.fetch("/a");

			expect(endpoint.dispatch).toBe(hot);
			expect(await second.text()).toBe("v1");
		});

		it("should generate a body that calls the route handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			expect(jit(endpoint).toString()).toContain(
				"endpoint.route.handler",
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});

		it("should never swap the dispatcher when the route opts out with jit: false", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a), {
						jit: false,
					}),
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;

			const dispatch = endpoint.dispatch;

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(endpoint.dispatch).toBe(dispatch);
			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v1");
		});

		it("should never swap the dispatcher when the app opts out with jit: false", () => {
			const app = new Cudenix(
				new Module()
					.store(() => ({ a: "v1" }))
					.route("GET", "/a", (context) => ok(context.store.a)),
				{ jit: false },
			);

			app.listen({ port: 0 });

			const port = app.server!.port!;
			const endpoint = app.methods.GET!.endpoints[0]!;
			const dispatch = endpoint.dispatch;

			return fetch(`http://localhost:${port}/a`)
				.then((response) => response.text())
				.then((text) => {
					expect(text).toBe("v1");
					expect(endpoint.dispatch).toBe(dispatch);
				})
				.finally(() => {
					app.server?.stop(true);
				});
		});
	});

	describe("parity with walk", () => {
		it("should run a store, validator, middleware, and route identically when jitted", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ a: "store" }))
					.validator({ request: { body: { v: "" } } })
					.middleware(async (_, next) => {
						await next();
					})
					.route("GET", "/a", (context) =>
						ok(`${context.store.a}:${context.request.body.v}`),
					),
				{
					plugins: [
						withValidator(() => ({
							content: { v: "valid" },
							success: true,
						})),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const cold = endpoint.dispatch;

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("store:valid");
			expect(await second.text()).toBe("store:valid");
			expect(endpoint.dispatch).not.toBe(cold);
		});

		it("should short-circuit on a failing store when jitted", async () => {
			let ran = 0;

			using server = serveApp(
				new Module()
					.store(() => fail("denied", { status: 401 }))
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(first.status).toBe(401);
			expect(second.status).toBe(401);
			expect(ran).toBe(0);
		});

		it("should let a middleware short-circuit without calling next when jitted", async () => {
			let ran = 0;

			using server = serveApp(
				new Module()
					.middleware(() => ok("short"))
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("short");
			expect(await second.text()).toBe("short");
			expect(ran).toBe(0);
		});

		it("should 422 on a failing validator when jitted", async () => {
			let ran = 0;

			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", () => {
						ran++;

						return ok("v1");
					}),
				{
					plugins: [
						withValidator(() => ({
							content: [{ message: "bad" }],
							success: false,
						})),
					],
				},
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(first.status).toBe(422);
			expect(second.status).toBe(422);
			expect(await second.json()).toEqual({ body: [{ message: "bad" }] });
			expect(ran).toBe(0);
		});

		it("should preserve nested middleware order when jitted", async () => {
			const order: string[] = [];

			using server = serveApp(
				new Module()
					.middleware(async (_, next) => {
						order.push("m1-before");

						await next();

						order.push("m1-after");
					})
					.middleware(async (_, next) => {
						order.push("m2-before");

						await next();

						order.push("m2-after");
					})
					.route("GET", "/a", () => {
						order.push("route");

						return ok("v1");
					}),
			);

			await server.fetch("/a");

			order.length = 0;

			await server.fetch("/a");

			expect(order).toEqual([
				"m1-before",
				"m2-before",
				"route",
				"m2-after",
				"m1-after",
			]);
		});

		it("should validate every key of a multi-slot validator when jitted", async () => {
			using server = serveApp(
				new Module()
					.validator({
						request: { body: { v: "" }, query: { v: "" } },
					})
					.route("GET", "/a", (context) =>
						ok(
							`${context.request.body.v}:${context.request.query.v}`,
						),
					),
				{
					plugins: [
						withValidator((_schema, _input, slot) => ({
							content: { v: slot },
							success: true,
						})),
					],
				},
			);

			const first = await server.fetch("/a");
			const second = await server.fetch("/a");

			expect(await first.text()).toBe("body:query");
			expect(await second.text()).toBe("body:query");
		});
	});
});
