import { beforeAll, describe, expect, test } from "bun:test";

import { parseBody } from "@/utils/bodies/parse-body";
import { Empty } from "@/utils/objects/empty";

const request = (body: BodyInit, contentType?: string) =>
	new Request(
		"https://a.b/c",
		contentType === undefined
			? { body, method: "POST" }
			: {
					body,
					headers: { "content-type": contentType },
					method: "POST",
				},
	);

describe("parseBody", () => {
	describe("json bodies", () => {
		describe("with an object body", () => {
			let result: unknown;

			beforeAll(async () => {
				result = await parseBody(
					request(
						JSON.stringify({ a: "v1", b: "v2" }),
						"application/json",
					),
				);
			});

			test("should parse the body into the matching object", () => {
				expect(result).toEqual({ a: "v1", b: "v2" });
			});

			test("should return a parsed value rather than the raw string", () => {
				expect(typeof result).toBe("object");
			});
		});

		test("should parse an array body", async () => {
			const result = await parseBody(
				request(JSON.stringify(["v1", "v2"]), "application/json"),
			);

			expect(result).toEqual(["v1", "v2"]);
		});

		test("should parse a primitive number body", async () => {
			const result = await parseBody(request("42", "application/json"));

			expect(result).toBe(42);
		});

		test("should parse a primitive null body", async () => {
			const result = await parseBody(request("null", "application/json"));

			expect(result).toBeNull();
		});

		test("should match when a charset parameter trails the content type", async () => {
			const result = await parseBody(
				request(
					JSON.stringify({ a: "v1" }),
					"application/json; charset=utf-8",
				),
			);

			expect(result).toEqual({ a: "v1" });
		});
	});

	describe("octet-stream bodies", () => {
		let result: unknown;

		beforeAll(async () => {
			result = await parseBody(
				request(new Uint8Array([1, 2, 3]), "application/octet-stream"),
			);
		});

		test("should return an ArrayBuffer", () => {
			expect(result).toBeInstanceOf(ArrayBuffer);
		});

		test("should preserve the body bytes", () => {
			const bytes = new Uint8Array(result as ArrayBuffer);

			expect(Array.from(bytes)).toEqual([1, 2, 3]);
		});
	});

	describe("urlencoded form bodies", () => {
		describe("with two fields", () => {
			let result: Record<string, unknown>;

			beforeAll(async () => {
				result = (await parseBody(
					request("a=v1&b=v2", "application/x-www-form-urlencoded"),
				)) as Record<string, unknown>;
			});

			test("should capture the first field value", () => {
				expect(result.a).toBe("v1");
			});

			test("should capture the second field value", () => {
				expect(result.b).toBe("v2");
			});
		});

		test("should collapse a repeated field into an array in first-seen order", async () => {
			const result = (await parseBody(
				request("a=v1&a=v2&a=v3", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result.a).toEqual(["v1", "v2", "v3"]);
		});

		test("should decode percent escapes and '+' in field values", async () => {
			const result = (await parseBody(
				request("a=v1%20v2&b=c+d", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1 v2");
			expect(result.b).toBe("c d");
		});

		test("should match the content type set by URLSearchParams", async () => {
			const result = (await parseBody(
				request(new URLSearchParams("a=v1")),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1");
		});
	});

	describe("multipart form bodies", () => {
		describe("with text and file fields", () => {
			let result: Record<string, unknown>;

			beforeAll(async () => {
				const formData = new FormData();

				formData.append("a", "v1");
				formData.append(
					"b",
					new File(["v2"], "b.txt", { type: "text/plain" }),
				);

				result = (await parseBody(request(formData))) as Record<
					string,
					unknown
				>;
			});

			test("should capture a text field as a string", () => {
				expect(result.a).toBe("v1");
			});

			test("should keep a file field as a File", () => {
				expect(result.b).toBeInstanceOf(File);
				expect((result.b as File).name).toBe("b.txt");
			});
		});

		test("should collapse a repeated field into an array in first-seen order", async () => {
			const formData = new FormData();

			formData.append("a", "v1");
			formData.append("a", "v2");
			formData.append("a", "v3");

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

			expect(result.a).toEqual(["v1", "v2", "v3"]);
		});
	});

	describe("text and fallback bodies", () => {
		test("should read the body as text when there is no content type", async () => {
			const result = await parseBody(request("v1"));

			expect(result).toBe("v1");
		});

		test("should read the body as text for an unknown content type", async () => {
			const result = await parseBody(request("v1", "text/plain"));

			expect(result).toBe("v1");
		});

		test("should read the body as text for an unhandled 'application/*' type", async () => {
			const result = await parseBody(
				request("<a>v1</a>", "application/xml"),
			);

			expect(result).toBe("<a>v1</a>");
		});

		test("should read the body as text for a 'multipart/*' type that is not form-data", async () => {
			const result = await parseBody(request("v1", "multipart/mixed"));

			expect(result).toBe("v1");
		});
	});

	describe("content-type matching precision", () => {
		test("should not treat a longer look-alike type as json", async () => {
			const result = await parseBody(
				request(JSON.stringify({ a: "v1" }), "application/json5"),
			);

			expect(result).toBe(JSON.stringify({ a: "v1" }));
		});

		test("should match case-sensitively, falling back to text for upper-case", async () => {
			const result = await parseBody(
				request(JSON.stringify({ a: "v1" }), "APPLICATION/JSON"),
			);

			expect(result).toBe(JSON.stringify({ a: "v1" }));
		});

		test("should match an exact 'application/x-www-form-urlencoded' with no parameters", async () => {
			const result = (await parseBody(
				request("a=v1", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1");
		});
	});

	describe("dangerous field names", () => {
		test("should store `__proto__` as a real own key without polluting the prototype", async () => {
			const result = (await parseBody(
				request(
					"__proto__=v1&a=v2",
					"application/x-www-form-urlencoded",
				),
			)) as Record<string, unknown>;

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(result.a).toBe("v2");
			expect(({} as Record<string, unknown>).__proto__).not.toBe("v1");
		});

		test("should store `constructor` as a real own key without invoking inheritance", async () => {
			const result = (await parseBody(
				request(
					"constructor=v1&a=v2",
					"application/x-www-form-urlencoded",
				),
			)) as Record<string, unknown>;

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
			expect(result.a).toBe("v2");
		});
	});

	describe("return shape", () => {
		describe("with a form body", () => {
			let result: object;

			beforeAll(async () => {
				result = (await parseBody(
					request("a=v1", "application/x-www-form-urlencoded"),
				)) as object;
			});

			test("should return a dictionary inheriting from Empty", () => {
				expect(result).toBeInstanceOf(Empty);
			});

			test("should have a null prototype root (no Object.prototype methods)", () => {
				expect(
					Object.getPrototypeOf(Object.getPrototypeOf(result)),
				).toBeNull();
				expect("toString" in result).toBe(false);
				expect("hasOwnProperty" in result).toBe(false);
			});
		});

		test("should return a fresh dictionary on each call", async () => {
			const a = await parseBody(
				request("a=v1", "application/x-www-form-urlencoded"),
			);
			const b = await parseBody(
				request("a=v1", "application/x-www-form-urlencoded"),
			);

			expect(a).not.toBe(b);
		});
	});
});
