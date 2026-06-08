import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "./helpers";

// The runtime does not parse the body/query/headers onto context.request yet,
// so handlers read them directly from the raw `Request` (context.request.raw).
describe("usage: reading the request", () => {
	test("should read a JSON body via context.request.raw", async () => {
		const app = buildApp(
			new Module().route("POST", "/a", async (context) => {
				const body = (await context.request.raw.json()) as {
					name: string;
				};

				return ok({ echo: body.name });
			}),
		);

		const result = await app.fetch(
			req("/a", {
				body: JSON.stringify({ name: "ann" }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(await result.json()).toEqual({ echo: "ann" });
	});

	test("should read a request header", async () => {
		const app = buildApp(
			new Module().route("GET", "/a", (context) =>
				ok({ auth: context.request.raw.headers.get("authorization") }),
			),
		);

		const result = await app.fetch(
			req("/a", { headers: { authorization: "Bearer t" } }),
		);

		expect(await result.json()).toEqual({ auth: "Bearer t" });
	});

	test("should read a query parameter from the raw URL", async () => {
		const app = buildApp(
			new Module().route("GET", "/a", (context) =>
				ok({
					q: new URL(context.request.raw.url).searchParams.get("q"),
				}),
			),
		);

		const result = await app.fetch(req("/a?q=hello"));

		expect(await result.json()).toEqual({ q: "hello" });
	});
});
