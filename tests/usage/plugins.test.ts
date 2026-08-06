import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import {
	getRequestContext,
	globalRequestContext,
} from "@/ecosystem/plugins/global-request-context/global-request-context";
import { tryCatch } from "@/ecosystem/plugins/try-catch/try-catch";

import { serveApp } from "./helpers";

describe("usage: plugins", () => {
	describe("tryCatch", () => {
		it("should pass through a synchronous chain", async () => {
			using server = serveApp(
				new Module().use(tryCatch()).route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should pass through an asynchronous chain", async () => {
			using server = serveApp(
				new Module().use(tryCatch()).route("GET", "/a", async () => {
					await Bun.sleep(1);

					return ok("v1");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("v1");
		});

		it("should catch a synchronous throw", async () => {
			using server = serveApp(
				new Module().use(tryCatch()).route("GET", "/a", () => {
					throw new Error("v1");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
		});

		it("should catch a rejection from an async handler that never suspends", async () => {
			using server = serveApp(
				new Module().use(tryCatch()).route("GET", "/a", async () => {
					throw new Error("v1");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
		});

		it("should catch a rejection from an async handler that suspends", async () => {
			using server = serveApp(
				new Module().use(tryCatch()).route("GET", "/a", async () => {
					await Bun.sleep(1);

					throw new Error("v1");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
		});

		it("should catch a rejection from an async store", async () => {
			using server = serveApp(
				new Module()
					.use(tryCatch())
					.store(async () => {
						throw new Error("v1");
					})
					.route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
		});
	});

	describe("globalRequestContext", () => {
		it("should expose the context to a synchronous chain", async () => {
			using server = serveApp(
				new Module()
					.use(globalRequestContext())
					.route("GET", "/a", () =>
						ok(getRequestContext()?.request.raw.method),
					),
			);

			expect(await (await server.fetch("/a")).text()).toBe("GET");
		});

		it("should expose the context to an asynchronous chain", async () => {
			using server = serveApp(
				new Module()
					.use(globalRequestContext())
					.route("GET", "/a", async () => {
						await Bun.sleep(1);

						return ok(getRequestContext()?.request.raw.method);
					}),
			);

			expect(await (await server.fetch("/a")).text()).toBe("GET");
		});
	});
});
