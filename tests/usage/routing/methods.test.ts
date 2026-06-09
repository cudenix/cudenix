import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › methods", () => {
	describe("dispatch", () => {
		it("should dispatch a single GET route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("get")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("get");
		});

		it("should dispatch a single POST route", async () => {
			using server = serveApp(
				new Module().route("POST", "/a", () => ok("post")),
			);

			const result = await server.fetch("/a", { method: "POST" });

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("post");
		});

		it("should dispatch PUT, PATCH, and DELETE routes", async () => {
			using server = serveApp(
				new Module()
					.route("PUT", "/a", () => ok("put"))
					.route("PATCH", "/a", () => ok("patch"))
					.route("DELETE", "/a", () => ok("delete")),
			);

			const put = await server.fetch("/a", { method: "PUT" });
			const patch = await server.fetch("/a", { method: "PATCH" });
			const remove = await server.fetch("/a", { method: "DELETE" });

			expect(await put.text()).toBe("put");
			expect(await patch.text()).toBe("patch");
			expect(await remove.text()).toBe("delete");
		});
	});

	describe("discrimination", () => {
		it("should route by method when GET and POST share a path", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("get"))
					.route("POST", "/a", () => ok("post")),
			);

			const get = await server.fetch("/a");
			const post = await server.fetch("/a", { method: "POST" });

			expect(await get.text()).toBe("get");
			expect(await post.text()).toBe("post");
		});

		it("should 404 a known path requested with an unregistered method", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("get")),
			);

			const get = await server.fetch("/a");
			const result = await server.fetch("/a", { method: "DELETE" });

			expect(get.status).toBe(200);
			expect(result.status).toBe(404);
		});

		it("should 404 a path that exists only under a different method", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/a", () => ok("get"))
					.route("POST", "/b", () => ok("post")),
			);

			const get = await server.fetch("/a");
			const result = await server.fetch("/a", { method: "POST" });

			expect(get.status).toBe(200);
			expect(result.status).toBe(404);
		});

		it("should not implicitly answer HEAD or OPTIONS from a GET route", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("get")),
			);

			const get = await server.fetch("/a");
			const head = await server.fetch("/a", { method: "HEAD" });
			const options = await server.fetch("/a", { method: "OPTIONS" });

			expect(get.status).toBe(200);
			expect(head.status).toBe(404);
			expect(options.status).toBe(404);
		});
	});

	describe("non-canonical verbs", () => {
		it("should dispatch a custom verb route declared on a regexp-only path", async () => {
			using server = serveApp(
				new Module().route("PURGE", "/a/...r1", () => ok("purge")),
			);

			const purge = await server.fetch("/a/b", { method: "PURGE" });
			const get = await server.fetch("/a/b");

			expect(purge.status).toBe(200);
			expect(await purge.text()).toBe("purge");
			expect(get.status).toBe(404);
		});

		it("should throw on listen when a custom verb is declared on a static path", () => {
			expect(() =>
				serveApp(new Module().route("PURGE", "/a", () => ok("purge"))),
			).toThrow(TypeError);
		});

		it("should throw on listen when a lowercase method is declared on a static path", () => {
			expect(() =>
				serveApp(new Module().route("get", "/a", () => ok("get"))),
			).toThrow(TypeError);
		});

		it("should never match a lowercase method declared on a regexp-only path", async () => {
			using server = serveApp(
				new Module().route("get", "/a/...r1", () => ok("get")),
			);

			const result = await server.fetch("/a/b");

			expect(result.status).toBe(404);
		});
	});
});
