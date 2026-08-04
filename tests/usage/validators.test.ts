import { describe, expect, it } from "bun:test";

import { Cudenix, type Plugin } from "@/core/cudenix";
import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import type { ValidatorCompiler, ValidatorPlugin } from "@/core/validator";
import { initializeStandardSchema } from "@/ecosystem/plugins/standard-schema";
import { isAsync } from "@/utils/functions/is-async";
import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

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

/**
 * A Standard Schema carrying the vendor's own asynchrony flag.
 */
interface TestSchema<Output> extends StandardSchemaV1<Output, Output> {
	async: boolean;
}

interface TestSchemaOptions {
	invalid?: boolean;
	vendor?: string;
}

const validateInput = <Output>(input: unknown, invalid: boolean) =>
	invalid ? { issues: [{ message: "v1" }] } : { value: input as Output };

const syncSchema = <Output>({
	invalid = false,
	vendor = "a",
}: TestSchemaOptions = {}): TestSchema<Output> => ({
	"~standard": {
		validate: (input) => validateInput<Output>(input, invalid),
		vendor,
		version: 1,
	},
	async: false,
});

const asyncSchema = <Output>({
	invalid = false,
	vendor = "a",
}: TestSchemaOptions = {}): TestSchema<Output> => ({
	"~standard": {
		validate: async (input) => validateInput<Output>(input, invalid),
		vendor,
		version: 1,
	},
	async: true,
});

// compiles only the schemas the vendor marks as synchronous
const compileSchema: ValidatorCompiler = (schema) =>
	schema.async
		? undefined
		: {
				run: (input) => {
					const returned = schema["~standard"].validate(input);

					return {
						content: returned.issues ?? returned.value,
						success: !returned.issues,
					};
				},
				sync: true,
			};

const compileAwaitedSchema: ValidatorCompiler = (schema) => ({
	run: async (input) => {
		const returned = await schema["~standard"].validate(input);

		return {
			content: returned.issues ?? returned.value,
			success: !returned.issues,
		};
	},
	sync: false,
});

describe("usage: validators", () => {
	describe("plugin contract", () => {
		it("should install Standard Schema as an explicitly async validator", async () => {
			const app = new Cudenix(new Module());

			initializeStandardSchema().call(app);

			const validator = app.memory.validator as ValidatorPlugin;
			const schema = {
				"~standard": {
					validate: async (input: unknown) => ({ value: input }),
				},
			};

			expect(isAsync(validator)).toBe(true);
			expect(await validator(schema, "v1", "body")).toEqual({
				content: "v1",
				success: true,
			});
		});

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

		it("should apply a used module's validator to its own routes", async () => {
			using server = serveApp(
				new Module().use(
					new Module()
						.validator({ request: { body: { v: "" } } })
						.route("GET", "/a", () => ok("v1")),
				),
				{ plugins: [withValidator(reject([{ message: "bad" }]))] },
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
		});

		it("should apply a used module's validator to a sibling route declared after the use", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.use(
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

	describe("compiled validators", () => {
		it("should register no compiler when the plugin gets none", () => {
			const app = new Cudenix(new Module());

			initializeStandardSchema().call(app);

			expect(app.memory.validator).toBeDefined();
			expect(app.memory.validatorCompiler).toBeUndefined();
		});

		it("should stay inert when only a compiler is registered", async () => {
			using server = serveApp(
				new Module()
					.validator({
						request: { query: syncSchema<{ a: string }>() },
					})
					.route("GET", "/a", (context) =>
						ok(typeof context.request.query),
					),
				{
					plugins: [
						function (this: Cudenix) {
							this.memory.validatorCompiler = compileSchema;
						},
					],
				},
			);

			const result = await server.fetch("/a?a=v1");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("undefined");
		});

		it("should dispatch a fully compiled route synchronously", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a/:p1",
					(context) =>
						ok(
							`${context.request.params.p1}:${context.request.query.a}`,
						),
					{
						validator: {
							request: {
								params: syncSchema<{ p1: string }>(),
								query: syncSchema<{ a: string }>(),
							},
						},
					},
				),
				{
					plugins: [
						initializeStandardSchema({
							compilers: { a: compileSchema },
						}),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const result = await server.fetch("/a/b?a=v1");

			expect(isAsync(endpoint.dispatch)).toBe(false);
			expect(result.status).toBe(200);
			expect(await result.text()).toBe("b:v1");
		});

		it("should fail identically through the compiled and the fallback path", async () => {
			const module = () =>
				new Module().route("GET", "/a", () => ok("v1"), {
					validator: {
						request: { query: syncSchema({ invalid: true }) },
					},
				});

			using fallback = serveApp(module(), {
				plugins: [initializeStandardSchema()],
			});
			using compiled = serveApp(module(), {
				plugins: [
					initializeStandardSchema({
						compilers: { a: compileSchema },
					}),
				],
			});

			const fallbackResult = await fallback.fetch("/a");
			const compiledResult = await compiled.fetch("/a");

			expect(
				isAsync(fallback.app.methods.GET!.endpoints[0]!.dispatch),
			).toBe(true);
			expect(
				isAsync(compiled.app.methods.GET!.endpoints[0]!.dispatch),
			).toBe(false);
			expect(compiledResult.status).toBe(fallbackResult.status);
			expect(compiledResult.status).toBe(422);
			expect(await compiledResult.text()).toBe(
				await fallbackResult.text(),
			);
		});

		it("should mix a compiled slot and a fallback slot in one link", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					(context) =>
						ok(
							`${context.request.headers.a}:${context.request.query.a}`,
						),
					{
						validator: {
							request: {
								headers: asyncSchema<{ a: string }>(),
								query: syncSchema<{ a: string }>(),
							},
						},
					},
				),
				{
					plugins: [
						initializeStandardSchema({
							compilers: { a: compileSchema },
						}),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const result = await server.fetch("/a?a=v1", {
				headers: { a: "v2" },
			});
			const source = endpoint.dispatch.toString();

			expect(isAsync(endpoint.dispatch)).toBe(true);
			expect(source).toContain("await validator(");
			expect(source).toContain("compiled[0].query(");
			expect(source).not.toContain("await compiled");
			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v2:v1");
		});

		it("should leave a schema from an unregistered vendor on the fallback", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					(context) => ok(context.request.query.a),
					{
						validator: {
							request: {
								query: syncSchema<{ a: string }>({
									vendor: "b",
								}),
							},
						},
					},
				),
				{
					plugins: [
						initializeStandardSchema({
							compilers: { a: compileSchema },
						}),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const result = await server.fetch("/a?a=v1");

			expect(isAsync(endpoint.dispatch)).toBe(true);
			expect(endpoint.dispatch.toString()).toContain("validator(");
			expect(endpoint.dispatch.toString()).not.toContain("compiled[");
			expect(await result.text()).toBe("v1");
		});

		it("should not read an inherited key as a registered vendor", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					(context) => ok(context.request.query.a),
					{
						validator: {
							request: {
								query: syncSchema<{ a: string }>({
									vendor: "constructor",
								}),
							},
						},
					},
				),
				{
					plugins: [
						initializeStandardSchema({
							compilers: { a: compileSchema },
						}),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const result = await server.fetch("/a?a=v1");

			expect(isAsync(endpoint.dispatch)).toBe(true);
			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should keep a compiled body slot asynchronous", async () => {
			using server = serveApp(
				new Module().route(
					"POST",
					"/a",
					(context) => ok(context.request.body.a),
					{
						validator: {
							request: { body: syncSchema<{ a: string }>() },
						},
					},
				),
				{
					plugins: [
						initializeStandardSchema({
							compilers: { a: compileSchema },
						}),
					],
				},
			);

			const endpoint = server.app.methods.POST!.endpoints[0]!;
			const result = await server.fetch("/a", {
				body: JSON.stringify({ a: "v1" }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});

			const source = endpoint.dispatch.toString();

			expect(isAsync(endpoint.dispatch)).toBe(true);
			expect(source).toContain("compiled[0].body(");
			expect(source).not.toContain("await compiled");
			expect(source).not.toContain("validator(");
			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should await a compiled validator that declares itself asynchronous", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					(context) => ok(context.request.query.a),
					{
						validator: {
							request: { query: syncSchema<{ a: string }>() },
						},
					},
				),
				{
					plugins: [
						initializeStandardSchema({
							compilers: { a: compileAwaitedSchema },
						}),
					],
				},
			);

			const endpoint = server.app.methods.GET!.endpoints[0]!;
			const result = await server.fetch("/a?a=v1");

			expect(isAsync(endpoint.dispatch)).toBe(true);
			expect(endpoint.dispatch.toString()).toContain(
				"await compiled[0].query(",
			);
			expect(await result.text()).toBe("v1");
		});

		it("should compile each slot of a shared validator link once", async () => {
			const compiled: string[] = [];
			const compiler: ValidatorCompiler = (schema, type) => {
				compiled.push(type);

				return compileSchema(schema, type);
			};

			using server = serveApp(
				new Module()
					.validator({
						request: { query: syncSchema<{ a: string }>() },
					})
					.route("GET", "/a", (context) =>
						ok(context.request.query.a),
					)
					.route("GET", "/b", (context) =>
						ok(context.request.query.a),
					),
				{
					plugins: [
						function (this: Cudenix) {
							initializeStandardSchema().call(this);

							this.memory.validatorCompiler = compiler;
						},
					],
				},
			);

			const first = await server.fetch("/a?a=v1");
			const second = await server.fetch("/b?a=v2");

			expect(compiled).toEqual(["query"]);
			expect(await first.text()).toBe("v1");
			expect(await second.text()).toBe("v2");
		});
	});
});
