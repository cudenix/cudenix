import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › prefixes", () => {
	describe("module prefix", () => {
		it("should serve routes under the module prefix", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).route("GET", "/a", () =>
					ok("v1"),
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should serve a root route at the prefix itself", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).route("GET", "/", () => ok("v1")),
			);

			const exact = await server.fetch("/v1");
			const trailing = await server.fetch("/v1/");

			expect(exact.status).toBe(200);
			expect(await exact.text()).toBe("v1");
			expect(trailing.status).toBe(404);
		});
	});

	describe("mount", () => {
		it("should compose the parent and mounted module prefixes", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).mount(
					new Module({ prefix: "/v2" }).route("GET", "/a", () =>
						ok("v1"),
					),
				),
			);

			const composed = await server.fetch("/v1/v2/a");
			const childOnly = await server.fetch("/v2/a");

			expect(composed.status).toBe(200);
			expect(await composed.text()).toBe("v1");
			expect(childOnly.status).toBe(404);
		});

		it("should keep mounted routes unchanged when no prefixes are set", async () => {
			using server = serveApp(
				new Module().mount(
					new Module().route("GET", "/a", () => ok("v1")),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should nest sibling routes declared after a prefixed mount under that prefix", async () => {
			using server = serveApp(
				new Module()
					.mount(
						new Module({ prefix: "/v1" }).route("GET", "/a", () =>
							ok("v1"),
						),
					)
					.route("GET", "/b", () => ok("v2")),
			);

			const mounted = await server.fetch("/v1/a");
			const nested = await server.fetch("/v1/b");
			const bare = await server.fetch("/b");

			expect(await mounted.text()).toBe("v1");
			expect(await nested.text()).toBe("v2");
			expect(bare.status).toBe(404);
		});
	});

	describe("group", () => {
		it("should serve group routes under the group prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/v1" },
				),
			);

			const prefixed = await server.fetch("/v1/a");
			const bare = await server.fetch("/a");

			expect(prefixed.status).toBe(200);
			expect(await prefixed.text()).toBe("v1");
			expect(bare.status).toBe(404);
		});

		it("should compose the module prefix with the group prefix", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).group(
					(module) => module.route("GET", "/a", () => ok("v1")),
					{ prefix: "/v2" },
				),
			);

			const result = await server.fetch("/v1/v2/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});
	});
});
