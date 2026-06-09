import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › wildcard", () => {
	it("should match a single segment with a wildcard", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/*", () => ok("v1")),
		);

		const result = await server.fetch("/a/1");

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("v1");
	});

	it("should match multiple segments with a wildcard", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/*", () => ok("v1")),
		);

		const result = await server.fetch("/a/1/2");

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("v1");
	});

	it("should 404 the bare prefix of a wildcard route", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/*", () => ok("v1")),
		);

		const hit = await server.fetch("/a/1");
		const bare = await server.fetch("/a");

		expect(hit.status).toBe(200);
		expect(bare.status).toBe(404);
	});

	it("should match the bare prefix with a trailing slash on a wildcard route", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/*", () => ok("v1")),
		);

		const result = await server.fetch("/a/");

		expect(result.status).toBe(200);
	});
});
