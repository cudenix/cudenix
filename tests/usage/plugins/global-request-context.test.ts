import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import {
	getRequestContext,
	globalRequestContext,
} from "@/ecosystem/plugins/global-request-context/global-request-context";

import { buildApp, req } from "../helpers";

// globalRequestContext() runs the chain inside an AsyncLocalStorage scope so
// downstream code can reach the current request context via getRequestContext()
// without threading it through arguments.
describe("usage: plugins › globalRequestContext", () => {
	test("should expose the current request context to downstream code", async () => {
		const app = buildApp(
			new Module()
				.mount(globalRequestContext())
				.route("GET", "/a", () =>
					ok({ url: getRequestContext()?.request.raw.url ?? null }),
				),
		);

		const result = await app.fetch(req("/a"));

		expect(await result.json()).toEqual({ url: "http://localhost/a" });
	});

	test("should return undefined outside of a request", () => {
		expect(getRequestContext()).toBeUndefined();
	});
});
