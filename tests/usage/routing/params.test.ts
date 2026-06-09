import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › params", () => {
	it("should match exactly one segment with a required param", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1", () => ok("v1")),
		);

		const result = await server.fetch("/a/1");

		expect(result.status).toBe(200);
		expect(await result.text()).toBe("v1");
	});

	it("should 404 when the param segment is missing", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1", () => ok("v1")),
		);

		const hit = await server.fetch("/a/1");
		const bare = await server.fetch("/a");
		const trailing = await server.fetch("/a/");

		expect(hit.status).toBe(200);
		expect(bare.status).toBe(404);
		expect(trailing.status).toBe(404);
	});

	it("should not let a param span multiple segments", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1", () => ok("v1")),
		);

		const single = await server.fetch("/a/1");
		const spanning = await server.fetch("/a/1/2");

		expect(single.status).toBe(200);
		expect(spanning.status).toBe(404);
	});

	it("should match multiple params separated by literal segments", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1/b/:p2", () => ok("v1")),
		);

		const hit = await server.fetch("/a/1/b/2");
		const miss = await server.fetch("/a/1/c/2");

		expect(hit.status).toBe(200);
		expect(await hit.text()).toBe("v1");
		expect(miss.status).toBe(404);
	});

	it("should match URL-encoded characters inside a param segment", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1", () => ok("v1")),
		);

		const result = await server.fetch("/a/1%202");

		expect(result.status).toBe(200);
	});

	it("should match an optional param with and without the segment", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1?", () => ok("v1")),
		);

		const without = await server.fetch("/a");
		const withSegment = await server.fetch("/a/1");
		const extra = await server.fetch("/a/1/2");

		expect(without.status).toBe(200);
		expect(withSegment.status).toBe(200);
		expect(extra.status).toBe(404);
	});

	it("should not expose URL params on the context yet (migration gap)", async () => {
		using server = serveApp(
			new Module().route("GET", "/a/:p1", (context) =>
				ok(typeof context.request.params),
			),
		);

		const result = await server.fetch("/a/1");

		expect(await result.text()).toBe("undefined");
	});
});
