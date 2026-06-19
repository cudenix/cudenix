import { describe, expect, it } from "bun:test";

import { Cudenix } from "@/core/cudenix";
import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: mounts", () => {
	describe("delegation", () => {
		it("should delegate a request under the prefix to the mounted fetch", async () => {
			using server = serveApp(
				new Module().mount(() => new Response("mounted"), {
					prefix: "/api",
				}),
			);

			const result = await server.fetch("/api/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("mounted");
		});

		it("should strip the prefix so the mounted handler sees a root-relative path", async () => {
			using server = serveApp(
				new Module().mount(
					(request) => new Response(new URL(request.url).pathname),
					{ prefix: "/api" },
				),
			);

			const result = await server.fetch("/api/a/b");

			expect(await result.text()).toBe("/a/b");
		});

		it("should serve the mounted handler at the prefix itself with a root path", async () => {
			using server = serveApp(
				new Module().mount(
					(request) => new Response(new URL(request.url).pathname),
					{ prefix: "/api" },
				),
			);

			const exact = await server.fetch("/api");
			const trailing = await server.fetch("/api/");

			expect(await exact.text()).toBe("/");
			expect(await trailing.text()).toBe("/");
		});

		it("should preserve the query string when delegating", async () => {
			using server = serveApp(
				new Module().mount(
					(request) => {
						const url = new URL(request.url);

						return new Response(`${url.pathname}${url.search}`);
					},
					{ prefix: "/api" },
				),
			);

			const result = await server.fetch("/api/a?x=1&y=2");

			expect(await result.text()).toBe("/a?x=1&y=2");
		});

		it("should preserve the request method when delegating", async () => {
			using server = serveApp(
				new Module().mount((request) => new Response(request.method), {
					prefix: "/api",
				}),
			);

			const result = await server.fetch("/api/a", { method: "DELETE" });

			expect(await result.text()).toBe("DELETE");
		});

		it("should preserve the request body when delegating", async () => {
			using server = serveApp(
				new Module().mount(
					async (request) => new Response(await request.text()),
					{ prefix: "/api" },
				),
			);

			const result = await server.fetch("/api/echo", {
				body: "hello",
				method: "POST",
			});

			expect(await result.text()).toBe("hello");
		});

		it("should pass the mounted handler's response through unchanged", async () => {
			using server = serveApp(
				new Module().mount(
					() =>
						new Response("teapot", {
							headers: { "x-mounted": "yes" },
							status: 418,
						}),
					{ prefix: "/api" },
				),
			);

			const result = await server.fetch("/api/a");

			expect(result.status).toBe(418);
			expect(result.headers.get("x-mounted")).toBe("yes");
			expect(await result.text()).toBe("teapot");
		});
	});

	describe("matching", () => {
		it("should not match a path that only shares the prefix as a string", async () => {
			using server = serveApp(
				new Module().mount(() => new Response("mounted"), {
					prefix: "/api",
				}),
			);

			const result = await server.fetch("/apiserver");

			expect(result.status).toBe(404);
		});

		it("should fall through to 404 when neither a route nor a mount matches", async () => {
			using server = serveApp(
				new Module().mount(() => new Response("mounted"), {
					prefix: "/api",
				}),
			);

			const result = await server.fetch("/other");

			expect(result.status).toBe(404);
		});

		it("should prefer an app route over a mount sharing the prefix", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/api/health", () => ok("app"))
					.mount(() => new Response("mounted"), { prefix: "/api" }),
			);

			const route = await server.fetch("/api/health");
			const fallback = await server.fetch("/api/other");

			expect(await route.text()).toBe("app");
			expect(await fallback.text()).toBe("mounted");
		});

		it("should delegate a method the app does not define on a non-route path", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/api/info", () => ok("app"))
					.mount((request) => new Response(request.method), {
						prefix: "/api",
					}),
			);

			const route = await server.fetch("/api/info");
			const posted = await server.fetch("/api/data", { method: "POST" });

			expect(await route.text()).toBe("app");
			expect(await posted.text()).toBe("POST");
		});

		it("should pick the longest matching prefix", async () => {
			using server = serveApp(
				new Module()
					.mount(() => new Response("a"), { prefix: "/a" })
					.mount(() => new Response("b"), { prefix: "/a/b" }),
			);

			const deep = await server.fetch("/a/b/c");
			const exact = await server.fetch("/a/b");
			const shallow = await server.fetch("/a/c");

			expect(await deep.text()).toBe("b");
			expect(await exact.text()).toBe("b");
			expect(await shallow.text()).toBe("a");
		});
	});

	describe("root", () => {
		it("should delegate every unmatched request when mounted at the root", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/keep", () => ok("app"))
					.mount(
						(request) =>
							new Response(new URL(request.url).pathname),
					),
			);

			const route = await server.fetch("/keep");
			const anything = await server.fetch("/anything/deep");

			expect(await route.text()).toBe("app");
			expect(await anything.text()).toBe("/anything/deep");
		});
	});

	describe("prefixes", () => {
		it("should compose the mount prefix with the module prefix", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" }).mount(
					(request) => new Response(new URL(request.url).pathname),
					{ prefix: "/api" },
				),
			);

			const prefixed = await server.fetch("/v1/api/a");
			const bare = await server.fetch("/api/a");

			expect(await prefixed.text()).toBe("/a");
			expect(bare.status).toBe(404);
		});

		it("should compose the mount prefix with a group prefix", async () => {
			using server = serveApp(
				new Module().group(
					(module) =>
						module.mount(
							(request) =>
								new Response(new URL(request.url).pathname),
							{ prefix: "/api" },
						),
					{ prefix: "/v1" },
				),
			);

			const prefixed = await server.fetch("/v1/api/a");
			const bare = await server.fetch("/api/a");

			expect(await prefixed.text()).toBe("/a");
			expect(bare.status).toBe(404);
		});
	});

	describe("bleed isolation", () => {
		it("should not inherit a preceding use()'s prefix (absolute mount prefix)", async () => {
			using server = serveApp(
				new Module()
					.use(new Module({ prefix: "/v1" }))
					.mount(
						(request) =>
							new Response(new URL(request.url).pathname),
						{ prefix: "/api" },
					),
			);

			const absolute = await server.fetch("/api/x");
			const bled = await server.fetch("/v1/api/x");

			expect(await absolute.text()).toBe("/x");
			expect(bled.status).toBe(404);
		});

		it("should keep a root mount at the root after a prefixed use()", async () => {
			using server = serveApp(
				new Module()
					.use(new Module({ prefix: "/v1" }))
					.mount(
						(request) =>
							new Response(new URL(request.url).pathname),
					),
			);

			const anything = await server.fetch("/anything");

			expect(await anything.text()).toBe("/anything");
		});

		it("should not inherit a deeply nested use()'s composed prefix", async () => {
			using server = serveApp(
				new Module()
					.use(
						new Module({ prefix: "/v1" }).use(
							new Module({ prefix: "/v2" }),
						),
					)
					.mount(
						(request) =>
							new Response(new URL(request.url).pathname),
						{ prefix: "/api" },
					),
			);

			const absolute = await server.fetch("/api/x");
			const bled = await server.fetch("/v1/v2/api/x");

			expect(await absolute.text()).toBe("/x");
			expect(bled.status).toBe(404);
		});

		it("should keep the declaring module's own prefix but not a sibling use()'s", async () => {
			using server = serveApp(
				new Module({ prefix: "/v1" })
					.use(new Module({ prefix: "/v2" }))
					.mount(
						(request) =>
							new Response(new URL(request.url).pathname),
						{ prefix: "/api" },
					),
			);

			const own = await server.fetch("/v1/api/x");
			const sibling = await server.fetch("/v1/v2/api/x");

			expect(await own.text()).toBe("/x");
			expect(sibling.status).toBe(404);
		});
	});

	describe("interop", () => {
		it("should mount another Cudenix app's fetch", async () => {
			const sub = new Cudenix(
				new Module()
					.route("GET", "/", () => ok("sub:root"))
					.route("GET", "/a", () => ok("sub:a")),
			);

			sub.compile();

			using server = serveApp(
				new Module().mount((request) => sub.fetch(request), {
					prefix: "/sub",
				}),
			);

			const root = await server.fetch("/sub");
			const nested = await server.fetch("/sub/a");

			expect(await root.text()).toBe("sub:root");
			expect(await nested.text()).toBe("sub:a");
		});
	});
});
