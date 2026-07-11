import { describe, expect, it } from "bun:test";
import { ok } from "@/core/reply";
import { type Cudenix, Module } from "@/index";

import { type ServedApp, serveApp } from "./helpers";

interface ParityResult {
	direct: { body: string; marker?: string; status: number };
	native: { body: string; marker?: string; status: number };
	serverFallbackCalls: number;
}

const compareRouters = async (
	server: ServedApp,
	path: `/${string}`,
	init?: RequestInit,
): Promise<ParityResult> => {
	const originalFetch = server.app.fetch;

	let serverFallbackCalls = 0;

	server.app.fetch = function (this: Cudenix, request: Request) {
		serverFallbackCalls++;

		return originalFetch.call(this, request);
	};

	let nativeResponse: Response;

	try {
		nativeResponse = await server.fetch(path, init);
	} finally {
		server.app.fetch = originalFetch;
	}

	const directResponse = await originalFetch.call(
		server.app,
		new Request(server.url(path), init),
	);
	const directMarker = directResponse.headers.get("x-route") ?? undefined;
	const nativeMarker = nativeResponse.headers.get("x-route") ?? undefined;

	return {
		direct: {
			body: await directResponse.text(),
			...(directMarker ? { marker: directMarker } : {}),
			status: directResponse.status,
		},
		native: {
			body: await nativeResponse.text(),
			...(nativeMarker ? { marker: nativeMarker } : {}),
			status: nativeResponse.status,
		},
		serverFallbackCalls,
	};
};

const expectSameResult = (result: ParityResult) => {
	expect(result.native).toEqual(result.direct);
};

describe("usage: router parity", () => {
	describe("shared native grammar", () => {
		it("should resolve static, param, wildcard, query, and precedence identically", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/static", () => ok("static"))
					.route("GET", "/param/:id", () => ok("param"))
					.route("GET", "/wild/*", () => ok("wild"))
					.route("GET", "/priority/*", () => ok("wild-priority"))
					.route("GET", "/priority/:id", () => ok("param-priority"))
					.route("GET", "/priority/fixed", () =>
						ok("static-priority"),
					),
			);

			for (const [path, expected] of [
				["/static", "static"],
				["/static?q=1", "static"],
				["/param/1", "param"],
				["/wild/a/b", "wild"],
				["/priority/fixed", "static-priority"],
				["/priority/value", "param-priority"],
				["/priority/a/b", "wild-priority"],
			] as const) {
				const result = await compareRouters(server, path);

				expectSameResult(result);
				expect(result.native.body).toBe(expected);
				expect(result.serverFallbackCalls).toBe(0);
			}
		});

		it("should resolve methods identically", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/method", () => ok("get"))
					.route("POST", "/method", () => ok("post"))
					.route("PUT", "/method", () => ok("put"))
					.route("PATCH", "/method", () => ok("patch"))
					.route("DELETE", "/method", () => ok("delete"))
					.route("OPTIONS", "/method", () => ok("options")),
			);

			for (const [method, expected] of [
				["GET", "get"],
				["POST", "post"],
				["PUT", "put"],
				["PATCH", "patch"],
				["DELETE", "delete"],
				["OPTIONS", "options"],
			] as const) {
				const result = await compareRouters(server, "/method", {
					method,
				});

				expectSameResult(result);
				expect(result.native.body).toBe(expected);
				expect(result.serverFallbackCalls).toBe(0);
			}
		});
	});

	describe("fallback-only grammar", () => {
		it("should keep slash-normalized declarations out of Bun's table", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/trailing/", () => ok("trailing"))
					.route("GET", "/double//slash", () => ok("double")),
			);

			for (const [path, status, body] of [
				["/trailing", 200, "trailing"],
				["/trailing/", 404, ""],
				["/double/slash", 200, "double"],
				["/double//slash", 404, ""],
			] as const) {
				const result = await compareRouters(server, path);

				expectSameResult(result);
				expect(result.native).toEqual({ body, status });
				expect(result.serverFallbackCalls).toBe(1);
			}
		});

		it("should keep literal star-prefixed segments out of Bun's wildcard grammar", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/literal/*suffix", () => ok("suffix"))
					.route("GET", "/literal/**", () => ok("double-star")),
			);

			for (const [path, status, body] of [
				["/literal/value", 404, ""],
				["/literal/value/deep", 404, ""],
				["/literal/*suffix", 200, "suffix"],
				["/literal/**", 200, "double-star"],
			] as const) {
				const result = await compareRouters(server, path);

				expectSameResult(result);
				expect(result.native).toEqual({ body, status });
				expect(result.serverFallbackCalls).toBe(1);
			}
		});

		it("should serve custom methods and duplicate parameter names without making listen fail", async () => {
			using server = serveApp(
				new Module()
					.route("PURGE", "/custom", () => ok("purge"))
					.route("GET", "/duplicate/:id/:id", () => ok("duplicate")),
			);

			const custom = await compareRouters(server, "/custom", {
				method: "PURGE",
			});
			const duplicate = await compareRouters(server, "/duplicate/a/b");

			expectSameResult(custom);
			expectSameResult(duplicate);
			expect(custom.native.body).toBe("purge");
			expect(duplicate.native.body).toBe("duplicate");
			expect(custom.serverFallbackCalls).toBe(1);
			expect(duplicate.serverFallbackCalls).toBe(1);
		});

		it("should resolve optional, rest, empty-name, and non-terminal wildcard syntax identically", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/optional/:value?", (context) =>
						ok(context.request.params),
					)
					.route("GET", "/rest/...values", (context) =>
						ok(context.request.params),
					)
					.route("GET", "/empty/:", (context) =>
						ok(context.request.params),
					)
					.route("GET", "/middle/*/tail", () => ok("middle")),
			);

			for (const [path, expected] of [
				["/optional", "{}"],
				["/optional/value", '{"value":"value"}'],
				["/rest/a/b", '{"values":["a","b"]}'],
				["/empty/value", '{"":"value"}'],
				["/middle/a/b/tail", "middle"],
			] as const) {
				const result = await compareRouters(server, path);

				expectSameResult(result);
				expect(result.native).toEqual({ body: expected, status: 200 });
				expect(result.serverFallbackCalls).toBe(1);
			}
		});
	});

	describe("precedence and collisions", () => {
		it("should keep the first structurally equivalent param route", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/same/:x", () => ok("first"))
					.route("GET", "/same/:y", () => ok("second")),
			);

			const result = await compareRouters(server, "/same/value");

			expectSameResult(result);
			expect(result.native.body).toBe("first");
			expect(result.serverFallbackCalls).toBe(0);
		});

		it("should preserve specificity beyond the twenty-second segment", async () => {
			const prefix = Array.from(
				{ length: 22 },
				(_, index) => `s${index}`,
			).join("/");
			const paramPath = `/${prefix}/:value` as const;
			const staticPath = `/${prefix}/fixed` as const;

			using server = serveApp(
				new Module()
					.route("GET", paramPath, () => ok("param"))
					.route("GET", staticPath, () => ok("static")),
			);

			const result = await compareRouters(server, staticPath);

			expectSameResult(result);
			expect(result.native.body).toBe("static");
			expect(result.serverFallbackCalls).toBe(0);
		});
	});

	describe("normalized context", () => {
		it("should expose decoded params identically without requiring a validator", async () => {
			using server = serveApp(
				new Module().route("GET", "/params/:value", (context) =>
					ok(context.request.params),
				),
			);

			for (const [path, expected] of [
				["/params/hello%20world", '{"value":"hello world"}'],
				["/params/%C3%A9", '{"value":"é"}'],
				["/params/%2F", '{"value":"/"}'],
				["/params/%252F", '{"value":"%2F"}'],
				["/params/%FF", '{"value":"�"}'],
				["/params/%E0%A4%A", '{"value":"��A"}'],
				["/params/%ED%A0%80", '{"value":"�"}'],
				["/params/%ZZ", '{"value":"�"}'],
			] as const) {
				const result = await compareRouters(server, path);

				expectSameResult(result);
				expect(result.native).toEqual({ body: expected, status: 200 });
				expect(result.serverFallbackCalls).toBe(0);
			}
		});

		it("should not expose the regexp matcher as request context", async () => {
			using server = serveApp(
				new Module().route("GET", "/context/:value", (context) =>
					ok(typeof context.match),
				),
			);

			const result = await compareRouters(server, "/context/value");

			expectSameResult(result);
			expect(result.native.body).toBe("undefined");
		});
	});

	describe("HTTP transport boundary", () => {
		it("should select the same explicit HEAD handler while Bun strips the network body", async () => {
			using server = serveApp(
				new Module().route("HEAD", "/head", (context) => {
					context.response.headers.set("x-route", "head");

					return ok("head-body");
				}),
			);

			const result = await compareRouters(server, "/head", {
				method: "HEAD",
			});

			expect(result.native).toEqual({
				body: "",
				marker: "head",
				status: 200,
			});
			expect(result.direct).toEqual({
				body: "head-body",
				marker: "head",
				status: 200,
			});
			expect(result.serverFallbackCalls).toBe(0);
		});

		it("should document Bun's conditional-cache behavior for static table responses", async () => {
			using server = serveApp(
				new Module().route("GET", "/cached", ok("cached")),
			);

			const live = await server.fetch("/cached");
			const direct = await server.app.fetch(
				new Request(server.url("/cached")),
			);
			const etag = live.headers.get("etag");

			expect(live.status).toBe(direct.status);
			expect(await live.text()).toBe(await direct.text());
			expect(etag).not.toBeNull();
			expect(direct.headers.get("etag")).toBeNull();

			if (!etag) {
				throw new Error("Bun did not attach an ETag to a static route");
			}

			const conditionalLive = await server.fetch("/cached", {
				headers: { "if-none-match": etag },
			});
			const conditionalDirect = await server.app.fetch(
				new Request(server.url("/cached"), {
					headers: { "if-none-match": etag },
				}),
			);

			expect(conditionalLive.status).toBe(304);
			expect(conditionalDirect.status).toBe(200);
		});
	});
});
