import { describe, expect, it } from "bun:test";

import type { Cudenix, Plugin } from "@/core/cudenix";
import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import type { ValidatorPlugin } from "@/core/validator";

import { serveApp } from "./helpers";

const withValidator = (validate: ValidatorPlugin): Plugin =>
	function (this: Cudenix) {
		this.memory.validator = validate;
	};

const accept =
	(content: unknown): ValidatorPlugin =>
	() => ({ content, success: true });

const reject =
	(content: unknown): ValidatorPlugin =>
	() => ({ content, success: false });

describe("usage: validators", () => {
	describe("plugin contract", () => {
		it("should skip the validator step and run the route when no plugin is registered", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", (context) =>
						ok(typeof context.request.body),
					),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("undefined");
		});
	});

	describe("parsing", () => {
		it("should write the parsed value onto the request slot for the route", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", (context) =>
						ok(context.request.body.v),
					),
				{ plugins: [withValidator(accept({ v: "parsed" }))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("parsed");
		});

		it("should expose the parsed slot to a later store", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.store((context) => ({ seen: context.request.body.v }))
					.route("GET", "/a", (context) => ok(context.store.seen)),
				{ plugins: [withValidator(accept({ v: "parsed" }))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("parsed");
		});

		it("should expose the parsed slot to a later middleware", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.middleware((context) => ok(context.request.body.v))
					.route("GET", "/a", () => ok("unreached")),
				{ plugins: [withValidator(accept({ v: "parsed" }))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("parsed");
		});

		it("should let a later validator see an earlier validator's output for the same slot", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { n: 0 } } })
					.validator({ request: { body: { n: 0 } } })
					.route("GET", "/a", (context) =>
						ok(`${context.request.body.n}`),
					),
				{
					plugins: [
						withValidator((_schema, input) => ({
							content: {
								n: ((input as { n?: number })?.n ?? 0) + 1,
							},
							success: true,
						})),
					],
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("2");
		});

		it("should await an asynchronous validator plugin", async () => {
			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", (context) =>
						ok(context.request.body.v),
					),
				{
					plugins: [
						withValidator(async () => {
							await Promise.resolve();

							return { content: { v: "async" }, success: true };
						}),
					],
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("async");
		});
	});

	describe("failure", () => {
		it("should respond 422 with the issues under the slot key and skip the handler", async () => {
			let ran = false;

			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/a", () => {
						ran = true;

						return ok("v1");
					}),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({ body: [{ message: "bad" }] });
			expect(ran).toBe(false);
		});

		it("should aggregate issues from multiple failing slots into one envelope", async () => {
			using server = serveApp(
				new Module()
					.validator({
						request: { body: { v: "" }, query: { v: "" } },
					})
					.route("GET", "/a", () => ok("v1")),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({
				body: [{ message: "bad" }],
				query: [{ message: "bad" }],
			});
		});

		it("should report only the failing slot when another slot validates", async () => {
			using server = serveApp(
				new Module()
					.validator({
						request: { body: { v: "" }, query: { v: "" } },
					})
					.route("GET", "/a", () => ok("v1")),
				{
					plugins: [
						withValidator((_schema, _input, slot) =>
							slot === "query"
								? {
										content: [{ message: "bad-query" }],
										success: false,
									}
								: { content: { v: "ok" }, success: true },
						),
					],
				},
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({
				query: [{ message: "bad-query" }],
			});
		});

		it("should skip a later store and the handler when validation fails", async () => {
			const events: string[] = [];

			using server = serveApp(
				new Module()
					.validator({ request: { body: { v: "" } } })
					.store(() => {
						events.push("store");

						return { a: "v1" };
					})
					.route("GET", "/a", () => {
						events.push("route");

						return ok("v1");
					}),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(events).toEqual([]);
		});
	});

	describe("per-route validator", () => {
		it("should validate through the route's own validator option", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					(context) => ok(context.request.body.v),
					{ validator: { request: { body: { v: "" } } } },
				),
				{ plugins: [withValidator(accept({ v: "routeval" }))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("routeval");
		});

		it("should 422 through the route's own validator option on failure", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1"), {
					validator: { request: { body: { v: "" } } },
				}),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({ body: [{ message: "bad" }] });
		});
	});

	describe("scoping", () => {
		it("should not apply a module validator to routes declared before it", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.validator({ request: { body: { v: "" } } })
					.route("GET", "/b", () => ok("v2")),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(before.status).toBe(200);
			expect(await before.text()).toBe("v1");
			expect(after.status).toBe(422);
		});

		it("should keep a group validator scoped to the group", async () => {
			using server = serveApp(
				new Module()
					.group(
						(module) =>
							module
								.validator({ request: { body: { v: "" } } })
								.route("GET", "/a", () => ok("v1")),
						{ prefix: "/v1" },
					)
					.route("GET", "/b", () => ok("v2")),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const grouped = await server.fetch("/v1/a");
			const sibling = await server.fetch("/b");

			expect(grouped.status).toBe(422);
			expect(sibling.status).toBe(200);
			expect(await sibling.text()).toBe("v2");
		});

		it("should apply a mounted module's validator to its own routes", async () => {
			using server = serveApp(
				new Module().mount(
					new Module()
						.validator({ request: { body: { v: "" } } })
						.route("GET", "/a", () => ok("v1")),
				),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
		});

		it("should apply a mounted module's validator to a sibling route declared after the mount", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.mount(
						new Module().validator({
							request: { body: { v: "" } },
						}),
					)
					.route("GET", "/b", () => ok("v2")),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const before = await server.fetch("/a");
			const after = await server.fetch("/b");

			expect(before.status).toBe(200);
			expect(await before.text()).toBe("v1");
			expect(after.status).toBe(422);
		});
	});
});
