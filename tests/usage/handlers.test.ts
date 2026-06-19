import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: handlers", () => {
	describe("function handler", () => {
		it("should dispatch a synchronous function handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("sync")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("sync");
		});

		it("should resolve an asynchronous function handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async () => {
					await Promise.resolve();

					return ok("async");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("async");
		});

		it("should expose the raw request to the handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) =>
					ok(context.request.raw.method),
				),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe("GET");
		});
	});

	describe("static handler", () => {
		it("should accept a static ok envelope as the handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", ok("static")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("static");
		});

		it("should accept a static fail envelope as the handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", fail("nope")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(400);
			expect(await result.text()).toBe("nope");
		});
	});

	describe("equivalence", () => {
		it("should produce identical responses for a static and a function handler", async () => {
			using fnServer = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);
			using staticServer = serveApp(
				new Module().route("GET", "/a", ok("v1")),
			);

			const fnResult = await fnServer.fetch("/a");
			const staticResult = await staticServer.fetch("/a");

			expect(fnResult.status).toBe(staticResult.status);
			expect(await fnResult.text()).toBe(await staticResult.text());
		});
	});

	describe("generator handler", () => {
		it("should stream a generator handler as text/event-stream", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("frame1") };
					yield { data: ok("frame2") };

					return ok("final");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toBe(
				"text/event-stream",
			);
			expect(await result.text()).toBe(
				'data: "frame1"\n\ndata: "frame2"\n\ndata: "final"\n\n',
			);
		});
	});
});
