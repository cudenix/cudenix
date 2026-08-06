import { describe, expect, it } from "bun:test";

import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";

import { serveApp } from "./helpers";

describe("usage: responses", () => {
	describe("content types", () => {
		it("should serialize an object payload as JSON", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok({ a: "v1", b: 2 })),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual({ a: "v1", b: 2 });
		});

		it("should serialize an array payload as JSON", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok([1, 2, 3])),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual([1, 2, 3]);
		});

		it("should send a string payload as plain text", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toContain("text/plain");
			expect(await result.text()).toBe("v1");
		});

		it("should stringify a numeric payload into the body", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok(123)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("123");
		});

		it("should stringify a zero payload into the body", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok(0)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("0");
		});

		it("should stringify a boolean payload into the body", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok(false)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("false");
		});

		it("should answer 200 with an empty body for an empty-string payload", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("");
		});

		it("should answer 204 for a null payload", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok(null)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
		});

		it("should answer 204 for an undefined payload", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok(undefined)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
		});
	});

	describe("status codes", () => {
		it("should default an ok reply to 200", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => ok("v1")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
		});

		it("should carry a custom ok status onto the response", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () =>
					ok("v1", { status: 201 }),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(201);
			expect(await result.text()).toBe("v1");
		});

		it("should default a fail reply to 400", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => fail("nope")),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(400);
			expect(await result.text()).toBe("nope");
		});

		it("should carry a custom fail status onto the response", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () =>
					fail("boom", { status: 500 }),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(500);
			expect(await result.text()).toBe("boom");
		});

		it("should serialize a fail object payload as JSON under its status", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () =>
					fail({ error: "invalid" }, { status: 422 }),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({ error: "invalid" });
		});

		it("should collapse a fail with null content to 204, dropping the error status", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () => fail(null)),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
		});

		it("should collapse null content to 204 even with a custom status", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () =>
					ok(null, { status: 201 }),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
		});
	});

	describe("raw response", () => {
		it("should pass a handler-returned Response through with its own status and headers", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", () =>
					ok(
						new Response("raw", {
							headers: { "x-custom": "v1" },
							status: 207,
						}),
					),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(207);
			expect(result.headers.get("x-custom")).toBe("v1");
			expect(await result.text()).toBe("raw");
		});
	});

	describe("staged headers", () => {
		it("should carry a staged header onto a JSON response under its status", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set("x-a", "v1");
					context.response.headers.set("x-b", "v2");

					return ok({ a: "v1" }, { status: 201 });
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(201);
			expect(result.headers.get("x-a")).toBe("v1");
			expect(result.headers.get("x-b")).toBe("v2");
			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual({ a: "v1" });
		});

		it("should let a staged content-type override the JSON default", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set(
						"content-type",
						"application/vnd.api+json",
					);

					return ok({ a: "v1" });
				}),
			);

			const result = await server.fetch("/a");

			expect(result.headers.get("content-type")).toBe(
				"application/vnd.api+json",
			);
			expect(await result.json()).toEqual({ a: "v1" });
		});

		it("should let a staged content-type override the one inferred from a text body", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set("content-type", "text/csv");

					return ok("a,b,c");
				}),
			);

			const result = await server.fetch("/a");

			expect(result.headers.get("content-type")).toBe("text/csv");
			expect(await result.text()).toBe("a,b,c");
		});

		it("should keep both values of a twice-appended vary", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.append("vary", "origin");
					context.response.headers.append("vary", "accept-encoding");

					return ok({ a: "v1" });
				}),
			);

			const result = await server.fetch("/a");

			expect(result.headers.get("vary")).toBe("origin, accept-encoding");
		});

		it("should carry staged headers onto a 204", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set("x-a", "v1");

					return ok(null);
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(result.headers.get("x-a")).toBe("v1");
			expect(await result.text()).toBe("");
		});

		it("should keep every staged set-cookie header rather than only the last", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.append("set-cookie", "a=v1");
					context.response.headers.append("set-cookie", "b=v2");

					return ok({ a: "v1" });
				}),
			);

			const result = await server.fetch("/a");

			expect(result.headers.getSetCookie()).toEqual(["a=v1", "b=v2"]);
		});

		it("should append staged cookies after staged headers", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set("x-a", "v1");
					context.response.cookies.set("a", "v1");
					context.response.cookies.set("b", "v2");

					return ok({ a: "v1" });
				}),
			);

			const result = await server.fetch("/a");

			expect(result.headers.get("x-a")).toBe("v1");

			const setCookie = result.headers.getSetCookie();

			expect(setCookie).toHaveLength(2);
			expect(setCookie[0]).toContain("a=v1");
			expect(setCookie[1]).toContain("b=v2");
		});

		it("should merge staged headers onto a handler-returned Response", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.set("x-a", "v1");
					context.response.headers.append("vary", "accept-encoding");

					return ok(
						new Response("raw", {
							headers: {
								vary: "origin",
								"x-a": "v2",
								"x-b": "v2",
							},
							status: 207,
						}),
					);
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(207);
			// a staged header replaces the one the response carried
			expect(result.headers.get("x-a")).toBe("v1");
			// one it did not stage survives untouched
			expect(result.headers.get("x-b")).toBe("v2");
			// vary accumulates instead of replacing
			expect(result.headers.get("vary")).toBe("origin, accept-encoding");
			expect(await result.text()).toBe("raw");
		});

		it("should leave the defaults alone when a handler reads headers without staging any", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", (context) => {
					context.response.headers.get("x-a");

					return ok({ a: "v1" });
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("x-a")).toBeNull();
			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual({ a: "v1" });
		});
	});

	describe("static handlers", () => {
		it("should serialize a static object envelope as JSON under its status", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					ok({ a: "v1" }, { status: 201 }),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(201);
			expect(result.headers.get("content-type")).toContain(
				"application/json",
			);
			expect(await result.json()).toEqual({ a: "v1" });
		});

		it("should serve a static null envelope as a prebuilt 204", async () => {
			using server = serveApp(new Module().route("GET", "/a", ok(null)));

			const result = await server.fetch("/a");

			expect(result.status).toBe(204);
			expect(await result.text()).toBe("");
		});

		it("should serve a static empty-string envelope as a prebuilt 200", async () => {
			using server = serveApp(new Module().route("GET", "/a", ok("")));

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe("");
		});

		it("should serialize a static fail object envelope under its status", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					fail({ error: "invalid" }, { status: 422 }),
				),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(422);
			expect(await result.json()).toEqual({ error: "invalid" });
		});

		it("should serialize a static envelope identically through Bun's table and the regexp fallback", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					ok({ a: "v1" }, { status: 201 }),
				),
			);

			const served = await server.fetch("/a");
			const fallback = await server.app.fetch(
				new Request(server.url("/a")),
			);

			expect(served.status).toBe(fallback.status);
			expect(await served.json()).toEqual(await fallback.json());
		});

		it("should produce identical responses for a static and a function object handler", async () => {
			using fnServer = serveApp(
				new Module().route("GET", "/a", () =>
					ok({ a: "v1" }, { status: 201 }),
				),
			);
			using staticServer = serveApp(
				new Module().route(
					"GET",
					"/a",
					ok({ a: "v1" }, { status: 201 }),
				),
			);

			const fnResult = await fnServer.fetch("/a");
			const staticResult = await staticServer.fetch("/a");

			expect(fnResult.status).toBe(staticResult.status);
			expect(await fnResult.json()).toEqual(await staticResult.json());
		});
	});
});
