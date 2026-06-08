import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › no params", () => {
	test("should resolve a static path to its handler", async () => {
		const app = buildApp(new Module().route("GET", "/a", () => ok("hit")));

		const result = await app.fetch(req("/a"));

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("hit");
	});

	test("should resolve the root path", async () => {
		const app = buildApp(new Module().route("GET", "/", () => ok("root")));

		const result = await app.fetch(req("/"));

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("root");
	});

	test("should 404 an unknown path", async () => {
		const app = buildApp(new Module().route("GET", "/a", () => ok("hit")));

		const result = await app.fetch(req("/b"));

		expect(result.status).toBe(404);
	});

	test("should 404 a path with a trailing slash", async () => {
		// The matcher anchors on `(?![^?#])`, so a trailing `/` leaves an
		// unmatched segment and the static path no longer matches.
		const app = buildApp(new Module().route("GET", "/a", () => ok("hit")));

		const result = await app.fetch(req("/a/"));

		expect(result.status).toBe(404);
	});

	test("should match a static path when a query string follows", async () => {
		// `?`/`#` terminate the matched path, so the query is not part of the
		// route — `/a` still resolves.
		const app = buildApp(new Module().route("GET", "/a", () => ok("hit")));

		const result = await app.fetch(req("/a?b=v1"));

		expect(result.status).toBe(200);
	});

	test("should match a static path when a hash fragment follows", async () => {
		const app = buildApp(new Module().route("GET", "/a", () => ok("hit")));

		const result = await app.fetch(req("/a#b"));

		expect(result.status).toBe(200);
	});
});
