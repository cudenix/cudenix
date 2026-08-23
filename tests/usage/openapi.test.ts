import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import {
	initializeOpenapi,
	openapi,
} from "@/ecosystem/plugins/openapi/openapi";

import { serveApp } from "./helpers";

/**
 * Stands in for a real schema converter: the plugin only forwards the result.
 */
const toJsonSchema = (schema: unknown) => schema as Record<string, unknown>;

const documentOf = (module: Parameters<typeof serveApp>[0]) => {
	using server = serveApp(module, {
		plugins: [initializeOpenapi(toJsonSchema)],
	});

	return server.app.memory.openapi as {
		info: Record<string, string>;
		openapi: string;
		paths: Record<string, Record<string, unknown>>;
		tags: { name: string }[];
	};
};

describe("usage: openapi", () => {
	describe("document", () => {
		it("should document the routes the app compiled", () => {
			const document = documentOf(
				new Module()
					.route("GET", "/users", () => ok([]))
					.route("POST", "/users", () => ok({}))
					.route("GET", "/users/:id", () => ok({})),
			);

			expect(document.openapi).toBe("3.1.0");
			expect(Object.keys(document.paths).sort()).toEqual([
				"/users",
				"/users/{id}",
			]);
			expect(Object.keys(document.paths["/users"]!).sort()).toEqual([
				"get",
				"post",
			]);
		});

		it("should not document a HEAD derived from a GET route", () => {
			const document = documentOf(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			expect(Object.keys(document.paths["/a"]!)).toEqual(["get"]);
		});

		it("should document a declared HEAD route", () => {
			const document = documentOf(
				new Module()
					.route("GET", "/a", () => ok("v1"))
					.route("HEAD", "/a", () => ok(null, { status: 204 })),
			);

			expect(Object.keys(document.paths["/a"]!).sort()).toEqual([
				"get",
				"head",
			]);
		});

		it("should rewrite params and spreads into openapi placeholders", () => {
			const document = documentOf(
				new Module()
					.route("GET", "/a/:p1", () => ok("v1"))
					.route("GET", "/b/:p1?", () => ok("v1"))
					.route("GET", "/c/...r1", () => ok("v1")),
			);

			expect(Object.keys(document.paths).sort()).toEqual([
				"/a/{p1}",
				"/b/{p1}",
				"/c/{r1}",
			]);

			const required = (path: string) =>
				(
					document.paths[path]!.get as {
						parameters: { name: string; required: boolean }[];
					}
				).parameters[0];

			expect(required("/a/{p1}")).toMatchObject({
				in: "path",
				name: "p1",
				required: true,
			});
			expect(required("/b/{p1}")).toMatchObject({
				name: "p1",
				required: false,
			});
			expect(required("/c/{r1}")).toMatchObject({
				name: "r1",
				schema: { pattern: ".*", type: "string" },
			});
		});

		it("should tag operations by their first static segment", () => {
			const document = documentOf(
				new Module()
					.route("GET", "/users/:id", () => ok({}))
					.route("GET", "/orders", () => ok([]))
					// a leading param has no static segment to tag with
					.route("GET", "/:root", () => ok({})),
			);

			expect(document.tags.map(({ name }) => name).sort()).toEqual([
				"orders",
				"users",
			]);
			expect(document.paths["/{root}"]!.get).not.toHaveProperty("tags");
		});
	});

	describe("routes", () => {
		it("should serve the document as json and the reference as html", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")).use(openapi()),
				{ plugins: [initializeOpenapi(toJsonSchema)] },
			);

			const json = await server.fetch("/openapi/json");
			const html = await server.fetch("/openapi");

			expect(json.headers.get("content-type")).toBe("application/json");
			expect(
				((await json.json()) as { paths: Record<string, unknown> })
					.paths,
			).toHaveProperty("/a");

			expect(html.headers.get("content-type")).toContain("text/html");
			expect(await html.text()).toContain("<!DOCTYPE html>");
		});
	});
});
