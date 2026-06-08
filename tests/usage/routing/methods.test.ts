import { describe, expect, test } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { buildApp, req } from "../helpers";

describe("usage: routing › methods", () => {
	test("should dispatch the handler registered for the request method", async () => {
		const app = buildApp(
			new Module()
				.route("GET", "/a", () => ok("get"))
				.route("POST", "/a", () => ok("post")),
		);

		const get = await app.fetch(req("/a"));
		const post = await app.fetch(req("/a", { method: "POST" }));

		expect(await get.text()).toBe("get");
		expect(await post.text()).toBe("post");
	});

	test("should 404 a known path requested with an unregistered method", async () => {
		// cudenix has no 405 Method Not Allowed: a method with no routing table
		// is simply a miss.
		const app = buildApp(new Module().route("GET", "/a", () => ok("get")));

		const result = await app.fetch(req("/a", { method: "DELETE" }));

		expect(result.status).toBe(404);
	});
});
