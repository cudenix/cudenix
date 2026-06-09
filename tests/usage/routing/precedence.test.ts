import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { ok } from "@/core/reply";

import { serveApp } from "../helpers";

describe("usage: routing › precedence", () => {
	it("should prefer a static route over a param route for its literal segment", async () => {
		using server = serveApp(
			new Module()
				.route("GET", "/a/:p1", () => ok("param"))
				.route("GET", "/a/b", () => ok("static")),
		);

		const literal = await server.fetch("/a/b");
		const dynamic = await server.fetch("/a/1");

		expect(await literal.text()).toBe("static");
		expect(await dynamic.text()).toBe("param");
	});

	it("should prefer a param route over a rest route for single-segment paths", async () => {
		using server = serveApp(
			new Module()
				.route("GET", "/a/...r1", () => ok("rest"))
				.route("GET", "/a/:p1", () => ok("param")),
		);

		const single = await server.fetch("/a/1");
		const deep = await server.fetch("/a/1/2");

		expect(await single.text()).toBe("param");
		expect(await deep.text()).toBe("rest");
	});

	it("should pick the first-registered among overlapping regexp-only routes", async () => {
		using restFirst = serveApp(
			new Module()
				.route("GET", "/a/...r1", () => ok("rest"))
				.route("GET", "/a/:p1?", () => ok("optional")),
		);
		using optionalFirst = serveApp(
			new Module()
				.route("GET", "/a/:p1?", () => ok("optional"))
				.route("GET", "/a/...r1", () => ok("rest")),
		);

		const rest = await restFirst.fetch("/a/1");
		const optional = await optionalFirst.fetch("/a/1");

		expect(await rest.text()).toBe("rest");
		expect(await optional.text()).toBe("optional");
	});
});
