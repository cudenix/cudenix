import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › paths", () => {
	it("should serve a route registered at the root path", async () => {
		using server = serveApp(new Module().route("GET", "/", () => ok("v1")));

		const result = await server.fetch("/");

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("v1");
	});

	it("should 404 an unknown path when only the root is registered", async () => {
		using server = serveApp(new Module().route("GET", "/", () => ok("v1")));

		const hit = await server.fetch("/");
		const miss = await server.fetch("/a");

		expect(hit.status).toBe(200);
		expect(miss.status).toBe(404);
	});

	it("should dispatch a deeply nested static path", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/b/c", () => ok("v1")),
		);

		const result = await server.fetch("/a/b/c");

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("v1");
	});

	it("should 404 a request with a trailing slash on a static route", async () => {
		using server = serveApp(
			new Module().route("GET", "/a", () => ok("v1")),
		);

		const exact = await server.fetch("/a");
		const trailing = await server.fetch("/a/");

		expect(exact.status).toBe(200);
		expect(trailing.status).toBe(404);
	});

	it("should 404 a request whose casing differs from the route", async () => {
		using server = serveApp(
			new Module().route("GET", "/a", () => ok("v1")),
		);

		const exact = await server.fetch("/a");
		const upper = await server.fetch("/A");

		expect(exact.status).toBe(200);
		expect(upper.status).toBe(404);
	});

	it("should ignore the query string when matching a path", async () => {
		using server = serveApp(
			new Module().route("GET", "/a", () => ok("v1")),
		);

		const result = await server.fetch("/a?b=c");

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("v1");
	});

	it("should 404 a request that extends past a registered path", async () => {
		using server = serveApp(
			new Module().route("GET", "/a", () => ok("v1")),
		);

		const exact = await server.fetch("/a");
		const extended = await server.fetch("/a/b");

		expect(exact.status).toBe(200);
		expect(extended.status).toBe(404);
	});

	it("should 404 a request that stops short of a registered path", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/b", () => ok("v1")),
		);

		const exact = await server.fetch("/a/b");
		const partial = await server.fetch("/a");

		expect(exact.status).toBe(200);
		expect(partial.status).toBe(404);
	});
});
