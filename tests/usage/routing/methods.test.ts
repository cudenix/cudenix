import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › methods", () => {
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

		const result = await server.fetch("/a", { method: "DELETE" });

		expect(result.status).toBe(404);
	});

	it("should 404 a path that exists only under a different method", async () => {
		using server = serveApp(
			new Module()
				.route("GET", "/a", () => ok("get"))
				.route("POST", "/b", () => ok("post")),
		);

		const result = await server.fetch("/a", { method: "POST" });

		expect(result.status).toBe(404);
	});
});
