import { describe, expect, it } from "bun:test";
import { fail, ok } from "@/core/reply";
import { type Cudenix, Module } from "@/index";
import { parseQuery } from "@/utils/urls/parse-query";

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

interface RawResult {
	body: string;
	serverFallbackCalls: number;
	status: number;
}

const decoder = new TextDecoder();

/**
 * Sends a raw HTTP request and reads the status and body off the wire.
 */
const rawRouters = async (
	server: ServedApp,
	request: string,
): Promise<RawResult> => {
	const originalFetch = server.app.fetch;

	let serverFallbackCalls = 0;

	server.app.fetch = function (this: Cudenix, incoming: Request) {
		serverFallbackCalls++;

		return originalFetch.call(this, incoming);
	};

	try {
		const received = await new Promise<string>((resolve, reject) => {
			let buffered = "";

			Bun.connect({
				hostname: "127.0.0.1",
				port: server.port,
				socket: {
					close() {
						resolve(buffered);
					},
					connectError(_socket, error) {
						reject(error);
					},
					data(_socket, chunk) {
						buffered += decoder.decode(chunk);
					},
					error(_socket, error) {
						reject(error);
					},
					open(socket) {
						socket.write(request);
					},
				},
			});
		});
		const separator = received.indexOf("\r\n\r\n");

		return {
			body: received.slice(separator + 4),
			serverFallbackCalls,
			// "HTTP/1.1 " is 9 characters
			status: Number(received.slice(9, 12)),
		};
	} finally {
		server.app.fetch = originalFetch;
	}
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

		it("should normalize route methods to uppercase", async () => {
			using server = serveApp(
				new Module()
					.route("get", "/lowercase-get", () => ok("get"))
					.route("purge", "/lowercase-purge", () => ok("purge")),
			);

			for (const [path, method, expected] of [
				["/lowercase-get", "GET", "get"],
				["/lowercase-purge", "PURGE", "purge"],
			] as const) {
				const result = await compareRouters(server, path, { method });

				expectSameResult(result);
				expect(result.native.body).toBe(expected);
			}

			expect(server.app.methods.GET).toBeDefined();
			expect(server.app.methods.PURGE).toBeDefined();
			expect(server.app.methods.get).toBeUndefined();
			expect(server.app.methods.purge).toBeUndefined();
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

		it("should preserve an earlier duplicate when a trailing optional rest is absent", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/duplicate-optional/:value/...value?",
					(context) => ok(context.request.params),
				),
			);

			for (const [path, expected] of [
				["/duplicate-optional/first", '{"value":"first"}'],
				[
					"/duplicate-optional/first/second/third",
					'{"value":["second","third"]}',
				],
			] as const) {
				const result = await compareRouters(server, path);

				expectSameResult(result);
				expect(result.native).toEqual({ body: expected, status: 200 });
				expect(result.serverFallbackCalls).toBe(1);
			}
		});

		it("should resolve early, middle, and late hits in a large fallback table", async () => {
			const module = new Module();

			for (let i = 0; i < 64; i++) {
				module.route(
					"GET",
					`/fallback/${i}/:value/:value` as `/${string}`,
					ok(String(i)),
				);
			}

			using server = serveApp(module);

			for (const index of [0, 31, 63]) {
				const result = await compareRouters(
					server,
					`/fallback/${index}/a/b`,
				);

				expectSameResult(result);
				expect(result.native.body).toBe(String(index));
				expect(result.serverFallbackCalls).toBe(1);
			}
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

		it("should preserve encoded slashes inside rest segments like Bun named params", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/pair/:first/:second", (context) =>
						ok([
							context.request.params.first,
							context.request.params.second,
						]),
					)
					.route("GET", "/rest-encoded/...values", (context) =>
						ok(context.request.params.values),
					),
			);

			for (const [suffix, expected] of [
				["a%2Fb/c", '["a/b","c"]'],
				["a/b%2Fc", '["a","b/c"]'],
				["%2F/c", '["/","c"]'],
				["a%252Fb/c", '["a%2Fb","c"]'],
				["a%/b", '["a�","b"]'],
				["%A/b", '["�A","b"]'],
			] as const) {
				const named = await compareRouters(server, `/pair/${suffix}`);
				const rest = await compareRouters(
					server,
					`/rest-encoded/${suffix}`,
				);

				expectSameResult(named);
				expectSameResult(rest);
				expect(named.native).toEqual({ body: expected, status: 200 });
				expect(rest.native).toEqual(named.native);
				expect(named.serverFallbackCalls).toBe(0);
				expect(rest.serverFallbackCalls).toBe(1);
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
					ok(Object.hasOwn(context, "match")),
				),
			);

			const result = await compareRouters(server, "/context/value");

			expectSameResult(result);
			expect(result.native.body).toBe("false");
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

	describe("request semantics shared by both paths", () => {
		it("should join duplicate headers with a comma and cookies with a semicolon", async () => {
			using server = serveApp(
				new Module().route("GET", "/headers", (context) => {
					const headers = context.request.raw.headers;

					return ok({
						cookie: headers.get("cookie"),
						dup: headers.get("x-dup"),
						empty: headers.get("x-empty"),
					});
				}),
			);

			const native = await rawRouters(
				server,
				`GET /headers HTTP/1.1\r\nHost: localhost:${server.port}\r\nX-Dup: a\r\nX-Dup: b\r\nCookie: a=1\r\nCookie: b=2\r\nX-Empty:\r\nConnection: close\r\n\r\n`,
			);
			const direct = await server.app.fetch(
				new Request(server.url("/headers"), {
					headers: [
						["x-dup", "a"],
						["x-dup", "b"],
						["cookie", "a=1"],
						["cookie", "b=2"],
						["x-empty", ""],
					],
				}),
			);

			expect(native.status).toBe(200);
			expect(native.body).toBe(
				'{"cookie":"a=1; b=2","dup":"a, b","empty":""}',
			);
			expect(await direct.text()).toBe(native.body);
			expect(native.serverFallbackCalls).toBe(0);
		});

		it("should expose the same url and query for exotic raw targets", async () => {
			using server = serveApp(
				new Module().route("GET", "/url", (context) =>
					ok(context.request.raw.url),
				),
			);

			for (const target of [
				"/url?a=<b>",
				"/url?a='b'",
				"/url?a=b|c",
				"/url?a=b^c",
				"/url?a=1?b=2",
				"/url?a=%zz",
				"/url?a=b\\c",
				"/url?a=1&&b=2",
				"/url?%",
				"/url??",
				"/url?a=[1]&b={}",
			]) {
				const native = await rawRouters(
					server,
					`GET ${target} HTTP/1.1\r\nHost: localhost:${server.port}\r\nConnection: close\r\n\r\n`,
				);
				const directUrl = new Request(
					server.url(target as `/${string}`),
				).url;

				expect(native.status).toBe(200);
				expect(native.body).toBe(directUrl);
				expect(parseQuery(native.body)).toEqual(parseQuery(directUrl));
			}
		});

		it("should decode malformed and exotic percent sequences identically", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/param/:value", (context) =>
						ok(context.request.params),
					)
					.route("GET", "/rest/...values", (context) =>
						ok(context.request.params),
					),
			);

			for (const encoded of [
				"%C0%AF",
				"%E0%80%AF",
				"%F0%80%80%AF",
				"%ED%A0%80",
				"%F4%90%80%80",
				"%F8%88%80%80%80",
				"%80",
				"%C3",
				"%E2%82",
				"%E2%82%AC%E2%82",
				"%2",
				"%",
				"%%41",
				"%G1",
				"%4G",
				"%00",
				"a%C3%A9b%FFc%E2%82%ACd",
				"%EF%BB%BF",
				"%2F%2F",
				"%5C",
				"!$'()*,;",
				"%C3%A9".repeat(50),
				"%41".repeat(300),
			]) {
				const named = await compareRouters(
					server,
					`/param/${encoded}` as `/${string}`,
				);
				const rest = await compareRouters(
					server,
					`/rest/${encoded}` as `/${string}`,
				);

				expectSameResult(named);
				expectSameResult(rest);
				expect(named.native.status).toBe(200);
				expect(named.serverFallbackCalls).toBe(0);
				expect(rest.serverFallbackCalls).toBe(1);
			}
		});

		it("should answer a derived HEAD natively with the GET status and no body", async () => {
			using server = serveApp(
				new Module().route("GET", "/head", () => ok("body")),
			);

			const result = await compareRouters(server, "/head", {
				method: "HEAD",
			});

			expect(result.native).toEqual({ body: "", status: 200 });
			expect(result.direct).toEqual({ body: "body", status: 200 });
			// Bun 1.4 answers HEAD from the GET handler in its own table
			expect(result.serverFallbackCalls).toBe(0);
		});

		it("should register TRACE and CONNECT routes in Bun's table", async () => {
			using server = serveApp(
				new Module()
					.route("TRACE", "/trace", () => ok("trace"))
					.route("CONNECT", "/connect", () => ok("connect")),
			);

			expect(Object.keys(server.app.routes["/trace"] ?? {})).toEqual([
				"TRACE",
			]);
			expect(Object.keys(server.app.routes["/connect"] ?? {})).toEqual([
				"CONNECT",
			]);

			// the wire keeps the TRACE body fetch() drops
			const trace = await rawRouters(
				server,
				`TRACE /trace HTTP/1.1\r\nHost: localhost:${server.port}\r\nConnection: close\r\n\r\n`,
			);
			const directTrace = await server.app.fetch(
				new Request(server.url("/trace"), { method: "TRACE" }),
			);
			const connect = await compareRouters(server, "/connect", {
				method: "CONNECT",
			});

			expect(trace).toEqual({
				body: "trace",
				serverFallbackCalls: 0,
				status: 200,
			});
			expect(await directTrace.text()).toBe("trace");
			expectSameResult(connect);
			expect(connect.native.body).toBe("connect");
			expect(connect.serverFallbackCalls).toBe(0);
		});
	});

	describe("origin-less request urls", () => {
		it("should resolve fallback-only routes without a usable Host header", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/native", () => ok("native"))
					.route("GET", "/optional/:value?", (context) =>
						ok(context.request.params),
					)
					.route("PURGE", "/purge", () => ok("purge"))
					.mount(() => new Response("mounted"), {
						prefix: "/mounted",
					}),
			);

			for (const [request, status, body, serverFallbackCalls] of [
				["GET /native HTTP/1.0\r\n\r\n", 200, "native", 0],
				[
					"GET /optional/value HTTP/1.0\r\n\r\n",
					200,
					'{"value":"value"}',
					1,
				],
				["GET /optional?q=1 HTTP/1.0\r\n\r\n", 200, "{}", 1],
				["PURGE /purge HTTP/1.0\r\n\r\n", 200, "purge", 1],
				// Bun 1.4 also leaves out the origin behind a malformed Host header
				[
					"GET /optional/value HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n",
					200,
					'{"value":"value"}',
					1,
				],
				[
					"GET /optional/value HTTP/1.1\r\nHost:\r\nConnection: close\r\n\r\n",
					200,
					'{"value":"value"}',
					1,
				],
				// a prefixed mount skips an origin-less url
				["GET /mounted/a HTTP/1.0\r\n\r\n", 404, "", 1],
			] as const) {
				expect(await rawRouters(server, request)).toEqual({
					body,
					serverFallbackCalls,
					status,
				});
			}
		});
	});

	describe("static table responses", () => {
		it("should keep a streamed static reply out of Bun's table and still serve it repeatedly", async () => {
			const encoder = new TextEncoder();
			const streamed = () =>
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode("streamed"));
						controller.close();
					},
				});

			using server = serveApp(
				new Module()
					.route("GET", "/stream", ok(streamed()))
					.route(
						"GET",
						"/response-stream",
						ok(new Response(streamed())),
					)
					.route("GET", "/text", ok("text"))
					.route("GET", "/json", ok({ a: 1 }))
					.route("GET", "/blob", ok(new Blob(["blob"])))
					.route("GET", "/file", ok(Bun.file(import.meta.path)))
					.route("GET", "/response", ok(new Response("response")))
					.route("GET", "/empty", ok(null)),
			);

			const table = server.app.routes as Record<
				string,
				Record<string, unknown> | undefined
			>;

			// only fully buffered bodies reach Bun's table as responses
			expect(typeof table["/stream"]?.GET).toBe("function");
			expect(typeof table["/response-stream"]?.GET).toBe("function");

			for (const path of [
				"/text",
				"/json",
				"/blob",
				"/file",
				"/response",
				"/empty",
			]) {
				expect(table[path]?.GET).toBeInstanceOf(Response);
			}

			for (const path of ["/stream", "/response-stream"] as const) {
				for (let i = 0; i < 3; i++) {
					const result = await compareRouters(server, path);

					expectSameResult(result);
					expect(result.native).toEqual({
						body: "streamed",
						status: 200,
					});
					expect(result.serverFallbackCalls).toBe(0);
				}
			}
		});

		it("should document Bun's conditional and range handling for static table responses", async () => {
			using server = serveApp(
				new Module()
					.route("GET", "/text", ok("text"))
					.route("GET", "/file", ok(Bun.file(import.meta.path)))
					.route("GET", "/failed", fail("nope")),
			);

			const etag = (await server.fetch("/text")).headers.get("etag");
			const failedEtag = (await server.fetch("/failed")).headers.get(
				"etag",
			);

			expect(etag).not.toBeNull();
			expect(failedEtag).not.toBeNull();

			if (!etag || !failedEtag) {
				throw new Error("Bun did not attach an ETag to a static route");
			}

			for (const [path, headers, nativeStatus, directStatus] of [
				// Bun validates preconditions only for its own static responses
				["/text", { "if-match": '"other"' }, 412, 200],
				["/text", { "if-none-match": etag }, 304, 200],
				["/text", { "if-none-match": `W/${etag}` }, 304, 200],
				["/text", { "if-match": etag }, 200, 200],
				// in-memory bodies ignore Range, file bodies answer it
				["/text", { range: "bytes=0-1" }, 200, 200],
				["/file", { range: "bytes=0-3" }, 206, 200],
				// a non-200 static reply carries an ETag but never turns into a 304
				["/failed", { "if-none-match": failedEtag }, 400, 400],
			] as const) {
				const result = await compareRouters(server, path, { headers });

				expect(result.native.status).toBe(nativeStatus);
				expect(result.direct.status).toBe(directStatus);
			}
		});
	});

	describe("raw request targets", () => {
		it("should document that Bun matches a raw backslash or dot segment before url normalization", async () => {
			using server = serveApp(
				new Module().route("GET", "/param/:value", (context) =>
					ok({
						params: context.request.params,
						url: context.request.raw.url,
					}),
				),
			);

			for (const [target, value, pathname] of [
				["/param/a\\b", "a\\b", "/param/a/b"],
				["/param/..", "..", "/"],
				["/param/%2e%2e", "..", "/"],
				["/param/.", ".", "/param/"],
			] as const) {
				const native = await rawRouters(
					server,
					`GET ${target} HTTP/1.1\r\nHost: localhost:${server.port}\r\nConnection: close\r\n\r\n`,
				);
				const direct = await server.app.fetch(
					new Request(server.url(target)),
				);

				expect(native.serverFallbackCalls).toBe(0);
				expect(native.status).toBe(200);
				expect(JSON.parse(native.body)).toEqual({
					params: { value },
					url: `http://localhost:${server.port}${pathname}`,
				});
				// the fallback sees the normalized url
				expect(direct.status).toBe(404);
			}
		});

		it("should resolve normalized dot segments identically through the fallback", async () => {
			using server = serveApp(
				new Module().route("GET", "/static", () => ok("static")),
			);

			for (const [target, status, body] of [
				["/static/../static", 200, "static"],
				["/static/./", 404, ""],
				["//static", 404, ""],
				["/static#fragment", 200, "static"],
			] as const) {
				const native = await rawRouters(
					server,
					`GET ${target} HTTP/1.1\r\nHost: localhost:${server.port}\r\nConnection: close\r\n\r\n`,
				);
				const direct = await server.app.fetch(
					new Request(server.url(target)),
				);

				expect(native).toEqual({
					body,
					serverFallbackCalls: 1,
					status,
				});
				expect(direct.status).toBe(status);
				expect(await direct.text()).toBe(body);
			}
		});
	});
});
