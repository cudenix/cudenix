import { describe, expect, test } from "bun:test";

import { Cudenix } from "@/core/cudenix";
import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import { initializeStandardSchema } from "@/ecosystem/plugins/standard-schema/standard-schema";
import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

import { req } from "./helpers";

/**
 * Migration note: the runtime does not parse the URL/body onto
 * `context.request` yet, and the validator only runs when a validator plugin is
 * registered. These tests pin the current wiring — including the gap where a
 * declared slot stays `undefined` until something upstream seeds it.
 */

const nameSchema: StandardSchemaV1<unknown, { name: string }> = {
	"~standard": {
		validate: (value) =>
			typeof value === "object" &&
			value !== null &&
			typeof (value as { name?: unknown }).name === "string"
				? { value: value as { name: string } }
				: { issues: [{ message: "expected { name: string }" }] },
		vendor: "test",
		version: 1,
	},
};

describe("usage: validation", () => {
	describe("without a validator plugin", () => {
		test("should skip the validator and run the handler", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", () => ok("reached"), {
					validator: { request: { query: nameSchema } },
				}),
			);

			app.compile();

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("reached");
		});
	});

	describe("with the standard-schema plugin", () => {
		test("should currently throw when serializing a failure (known bug)", async () => {
			// A failing slot short-circuits with `fail(errors, { status: 422 })`,
			// but `errors` is built as an `Empty` (null-prototype) bag that
			// `response()` cannot serialize: it falls through to
			// `new Response(<non-BodyInit>)` and throws instead of returning 422.
			// (The slot is also undefined here, since the runtime does not parse
			// it onto the request yet.) Flip this to assert a 422 once the error
			// map is a plain object.
			const app = new Cudenix(
				new Module().route("GET", "/a", () => ok("reached"), {
					validator: { request: { query: nameSchema } },
				}),
			).plugins([initializeStandardSchema()]);

			app.compile();

			const run = async () => {
				await app.fetch(req("/a"));
			};

			await expect(run()).rejects.toThrow();
		});

		test("should pass when the slot is seeded upstream", async () => {
			const app = new Cudenix(
				new Module()
					.middleware(async (context, next) => {
						// Seed the slot the runtime does not populate yet.
						(context.request as { query?: unknown }).query = {
							name: "ann",
						};

						await next();
					})
					.route("GET", "/a", () => ok("reached"), {
						validator: { request: { query: nameSchema } },
					}),
			).plugins([initializeStandardSchema()]);

			app.compile();

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("reached");
		});
	});
});
