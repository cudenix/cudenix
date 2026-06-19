import { describe, expect, it } from "bun:test";

import { Cudenix } from "@/core/cudenix";
import { Module } from "@/core/module";
import { fail, ok } from "@/core/reply";
import { stream } from "@/core/sse";

import { serveApp } from "./helpers";

describe("usage: sse", () => {
	describe("response shape", () => {
		it("should answer 200 with text/event-stream and no-cache for a generator handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("v1") };
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toBe(
				"text/event-stream",
			);
			expect(result.headers.get("cache-control")).toBe("no-cache");

			await result.text();
		});

		it("should support a synchronous generator handler", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", function* () {
					yield { data: ok("v1") };
					yield { data: ok("v2") };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('data: "v1"\n\ndata: "v2"\n\n');
		});
	});

	describe("frame serialization", () => {
		it("should serialize each yielded frame as a default message event", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("frame1") };
					yield { data: ok("frame2") };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe(
				'data: "frame1"\n\ndata: "frame2"\n\n',
			);
		});

		it("should JSON-encode an object payload onto the data field", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok({ a: "v1", b: 2 }) };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('data: {"a":"v1","b":2}\n\n');
		});

		it("should encode an undefined payload as null", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok(undefined) };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe("data: null\n\n");
		});

		it("should stream a fail frame as data only, dropping its status", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: fail("nope", { status: 500 }) };
				}),
			);

			const result = await server.fetch("/a");

			expect(result.status).toBe(200);
			expect(await result.text()).toBe('data: "nope"\n\n');
		});
	});

	describe("event channel", () => {
		it("should emit a custom event name", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("hi"), event: "tick" };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('event: tick\ndata: "hi"\n\n');
		});

		it("should omit the event field for the default message channel", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("hi"), event: "message" };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('data: "hi"\n\n');
		});
	});

	describe("id and retry fields", () => {
		it("should emit id and retry alongside data", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("hi"), id: "1", retry: 3000 };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe(
				'id: 1\nretry: 3000\ndata: "hi"\n\n',
			);
		});

		it("should order fields as id, event, retry, then data", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield {
						data: ok("hi"),
						event: "tick",
						id: "1",
						retry: 3000,
					};
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe(
				'id: 1\nevent: tick\nretry: 3000\ndata: "hi"\n\n',
			);
		});
	});

	describe("field sanitization", () => {
		it("should strip newlines from the id so it cannot inject fields", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("x"), id: "a\nb\rc" };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('id: abc\ndata: "x"\n\n');
		});

		it("should strip newlines from the event so it cannot inject fields", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("x"), event: "ev\nil" };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('event: evil\ndata: "x"\n\n');
		});
	});

	describe("returned envelope", () => {
		it("should emit the generator's returned envelope as a trailing event", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("frame1") };

					return ok("final");
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe(
				'data: "frame1"\n\ndata: "final"\n\n',
			);
		});

		it("should emit nothing extra when the generator returns undefined", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("frame1") };
				}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('data: "frame1"\n\n');
		});
	});

	describe("chain integration", () => {
		it("should expose store values to the generator", async () => {
			using server = serveApp(
				new Module()
					.store(() => ({ prefix: "store" }))
					.route("GET", "/a", async function* (context) {
						yield { data: ok(context.store.prefix) };
						yield { data: ok(`${context.store.prefix}:done`) };
					}),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe(
				'data: "store"\n\ndata: "store:done"\n\n',
			);
		});

		it("should let a middleware wrap a streaming route", async () => {
			using server = serveApp(
				new Module()
					.middleware(async (context, next) => {
						context.response.headers.set("x-mw", "v1");

						await next();
					})
					.route("GET", "/a", async function* () {
						yield { data: ok("v1") };
					}),
			);

			const result = await server.fetch("/a");

			expect(result.headers.get("x-mw")).toBe("v1");
			expect(result.headers.get("content-type")).toBe(
				"text/event-stream",
			);
			expect(await result.text()).toBe('data: "v1"\n\n');
		});
	});

	describe("dispatch parity", () => {
		it("should stream identically on the walk path and the JIT path", async () => {
			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("v1") };
					yield { data: ok("v2") };
				}),
			);

			const first = await (await server.fetch("/a")).text();
			const second = await (await server.fetch("/a")).text();

			expect(first).toBe('data: "v1"\n\ndata: "v2"\n\n');
			expect(second).toBe(first);
		});

		it("should stream with per-route JIT disabled", async () => {
			using server = serveApp(
				new Module().route(
					"GET",
					"/a",
					async function* () {
						yield { data: ok("v1") };
					},
					{ jit: false },
				),
			);

			const result = await server.fetch("/a");

			expect(await result.text()).toBe('data: "v1"\n\n');
		});

		it("should stream through the regexp fallback without a running server", async () => {
			const app = new Cudenix(
				new Module().route("GET", "/a", async function* () {
					yield { data: ok("v1") };
				}),
			);

			app.compile();

			const result = await app.fetch(new Request("http://localhost/a"));

			expect(result.status).toBe(200);
			expect(result.headers.get("content-type")).toBe(
				"text/event-stream",
			);
			expect(await result.text()).toBe('data: "v1"\n\n');
		});
	});

	describe("client disconnect", () => {
		it("should run the generator's finally when the client aborts", async () => {
			let cleaned = false;

			using server = serveApp(
				new Module().route("GET", "/a", async function* () {
					try {
						let i = 0;

						while (true) {
							yield { data: ok(i++) };

							await Bun.sleep(10);
						}
					} finally {
						cleaned = true;
					}
				}),
			);

			const controller = new AbortController();

			const result = await server.fetch("/a", {
				signal: controller.signal,
			});

			const reader = result.body!.getReader();

			await reader.read();

			controller.abort();

			for (let i = 0; i < 200 && !cleaned; i++) {
				await Bun.sleep(10);
			}

			expect(cleaned).toBe(true);
		});

		it("should swallow a rejection from the generator's cleanup on cancel", async () => {
			const generator = (async function* () {
				yield { data: ok("x") };
				yield { data: ok("y") };
			})();

			generator.return = (() =>
				Promise.reject(new Error("cleanup boom"))) as never;

			const reader = stream(generator).getReader();

			await reader.read();

			await expect(reader.cancel()).resolves.toBeUndefined();
		});
	});
});
