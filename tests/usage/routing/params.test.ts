import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › params", () => {
	describe("a single required parameter", () => {
		test("should match a path with the parameter segment present", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1", () => ok("hit")),
			);

			const result = await app.fetch(req("/a/v1"));

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("hit");
		});

		test("should 404 when the parameter segment is missing", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1", () => ok("hit")),
			);

			const result = await app.fetch(req("/a"));

			expect(result.status).toBe(404);
		});

		test("should 404 when an extra trailing segment is present", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1", () => ok("hit")),
			);

			const result = await app.fetch(req("/a/v1/v2"));

			expect(result.status).toBe(404);
		});

		test("should capture a segment that contains a dot", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1", () => ok("hit")),
			);

			const result = await app.fetch(req("/a/v1.v2"));

			expect(result.status).toBe(200);
		});
	});

	describe("multiple parameters", () => {
		test("should match every parameter segment", async () => {
			const app = buildApp(
				new Module().route("GET", "/a/:p1/b/:p2", () => ok("hit")),
			);

			const result = await app.fetch(req("/a/v1/b/v2"));

			expect(result.status).toBe(200);
		});
	});

	describe("current runtime", () => {
		test("should not yet surface the captured value to the handler", async () => {
			// The router matches the segment, but the current runtime does not
			// parse the capture onto `context.request` — params arrive only
			// through validators. This pins that behaviour during the migration;
			// update it once URL params are wired onto the request.
			const app = buildApp(
				new Module().route("GET", "/a/:p1", (context) =>
					ok({
						p1:
							(context.request as { params?: { p1?: string } })
								.params?.p1 ?? null,
					}),
				),
			);

			const result = await app.fetch(req("/a/v1"));

			expect(await result.json()).toEqual({ p1: null });
		});
	});
});
