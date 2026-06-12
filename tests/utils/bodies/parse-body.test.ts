import { beforeAll, describe, expect, it } from "bun:test";

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

			it("should parse the body into the matching object", () => {
				expect(result).toEqual({ a: "v1", b: "v2" });
			});
		});

		it("should parse an array body", async () => {
			const result = await parseBody(
				request(JSON.stringify(["v1", "v2"]), "application/json"),
			);

			expect(result).toEqual(["v1", "v2"]);
		});

		it("should parse a primitive number body", async () => {
			const result = await parseBody(request("1", "application/json"));

			expect(result).toBe(1);
		});

		it("should parse a primitive null body", async () => {
			const result = await parseBody(request("null", "application/json"));

			expect(result).toBeNull();
		});

		it("should match when a charset parameter trails the content type", async () => {
			const result = await parseBody(
				request(
					JSON.stringify({ a: "v1" }),
					"application/json; charset=utf-8",
				),
			);

			expect(result).toEqual({ a: "v1" });
		});

		it("should reject when the json body is malformed", async () => {
			await expect(
				parseBody(request("{bad", "application/json")),
			).rejects.toThrow();
		});

		it("should match a bare trailing semicolon with no parameter", async () => {
			const result = await parseBody(
				request(JSON.stringify({ a: "v1" }), "application/json;"),
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

		it("should return an ArrayBuffer", () => {
			expect(result).toBeInstanceOf(ArrayBuffer);
		});

		it("should preserve the body bytes", () => {
			const bytes = new Uint8Array(result as ArrayBuffer);

			expect(Array.from(bytes)).toEqual([1, 2, 3]);
		});

		it("should match when a parameter trails the octet-stream content type", async () => {
			const result = await parseBody(
				request(
					new Uint8Array([1, 2, 3]),
					"application/octet-stream; charset=binary",
				),
			);

			expect(result).toBeInstanceOf(ArrayBuffer);
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

			it("should capture the first field value", () => {
				expect(result.a).toBe("v1");
			});

			it("should capture the second field value", () => {
				expect(result.b).toBe("v2");
			});
		});

		it("should collapse a repeated field into an array in first-seen order", async () => {
			const result = (await parseBody(
				request("a=v1&a=v2&a=v3", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result.a).toEqual(["v1", "v2", "v3"]);
		});

		it("should decode percent escapes and '+' in field values", async () => {
			const result = (await parseBody(
				request("a=v1%20v2&b=c+d", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1 v2");
			expect(result.b).toBe("c d");
		});

		it("should match the content type set by URLSearchParams", async () => {
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

			it("should capture a text field as a string", () => {
				expect(result.a).toBe("v1");
			});

			it("should keep a file field as a File", () => {
				expect(result.b).toBeInstanceOf(File);
				expect((result.b as File).name).toBe("b.txt");
			});
		});

		it("should collapse a repeated field into an array in first-seen order", async () => {
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

		it("should collapse a repeated file field into an array of Files", async () => {
			const formData = new FormData();

			formData.append("a", new File(["v1"], "a.txt"));
			formData.append("a", new File(["v2"], "b.txt"));

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

			const files = result.a as File[];

			expect(files).toHaveLength(2);
			expect(files[0]).toBeInstanceOf(File);
			expect(files[1]).toBeInstanceOf(File);
			expect(files[0]?.name).toBe("a.txt");
			expect(files[1]?.name).toBe("b.txt");
		});

		it("should reject for 'multipart/form-data' without a boundary parameter", async () => {
			await expect(
				parseBody(request("v1", "multipart/form-data")),
			).rejects.toThrow();
		});
	});

	describe("text and fallback bodies", () => {
		it("should read the body as text when there is no content type", async () => {
			const result = await parseBody(request("v1"));

			expect(result).toBe("v1");
		});

		it("should read the body as text for an unknown content type", async () => {
			const result = await parseBody(request("v1", "text/plain"));

			expect(result).toBe("v1");
		});

		it("should read the body as text for an unhandled 'application/*' type", async () => {
			const result = await parseBody(
				request("<a>v1</a>", "application/xml"),
			);

			expect(result).toBe("<a>v1</a>");
		});

		it("should read the body as text for a 'multipart/*' type that is not form-data", async () => {
			const result = await parseBody(request("v1", "multipart/mixed"));

			expect(result).toBe("v1");
		});
	});

	describe("content-type matching precision", () => {
		it("should not treat a longer look-alike type as json", async () => {
			const result = await parseBody(
				request(JSON.stringify({ a: "v1" }), "application/json5"),
			);

			expect(result).toBe(JSON.stringify({ a: "v1" }));
		});

		it("should match case-sensitively, falling back to text for upper-case", async () => {
			const result = await parseBody(
				request(JSON.stringify({ a: "v1" }), "APPLICATION/JSON"),
			);

			expect(result).toBe(JSON.stringify({ a: "v1" }));
		});

		it("should match an exact 'application/x-www-form-urlencoded' with no parameters", async () => {
			const result = (await parseBody(
				request("a=v1", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1");
		});

		it("should not treat a longer look-alike type as a urlencoded form", async () => {
			const result = await parseBody(
				request("a=v1", "application/x-www-form-urlencodedx"),
			);

			expect(result).toBe("a=v1");
		});

		it("should not treat a longer look-alike type as a multipart form", async () => {
			const result = await parseBody(
				request("v1", "multipart/form-datax"),
			);

			expect(result).toBe("v1");
		});

		it("should fall back to text when whitespace precedes the parameter semicolon", async () => {
			const result = await parseBody(
				request(
					JSON.stringify({ a: "v1" }),
					"application/json ; charset=utf-8",
				),
			);

			expect(result).toBe(JSON.stringify({ a: "v1" }));
		});

		it("should fall back to text for a content type shorter than every match window", async () => {
			expect(await parseBody(request("v1", "a"))).toBe("v1");
			expect(await parseBody(request("v1", "m"))).toBe("v1");
		});
	});

	describe("dangerous field names", () => {
		it("should store `__proto__` as a real own key without polluting the prototype", async () => {
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

		it("should store `constructor` as a real own key without invoking inheritance", async () => {
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

		it("should store a multipart `__proto__` field as a real own key without polluting the prototype", async () => {
			const formData = new FormData();

			formData.append("__proto__", "v1");
			formData.append("a", "v2");

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(result.a).toBe("v2");
			expect(({} as Record<string, unknown>).__proto__).not.toBe("v1");
		});

		it("should store a multipart `constructor` field as a real own key without invoking inheritance", async () => {
			const formData = new FormData();

			formData.append("constructor", "v1");
			formData.append("a", "v2");

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

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

			it("should return a dictionary inheriting from Empty", () => {
				expect(result).toBeInstanceOf(Empty);
			});

			it("should have a null prototype root (no Object.prototype methods)", () => {
				expect(
					Object.getPrototypeOf(Object.getPrototypeOf(result)),
				).toBeNull();
				expect("toString" in result).toBe(false);
				expect("hasOwnProperty" in result).toBe(false);
			});
		});

		it("should return a fresh dictionary on each call", async () => {
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
