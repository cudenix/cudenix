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

		it("should reject with a SyntaxError when the json body is empty", async () => {
			const emptyBodyRequest = request("", "application/json");

			expect(emptyBodyRequest.headers.get("content-type")).toBe(
				"application/json",
			);
			await expect(parseBody(emptyBodyRequest)).rejects.toThrow(
				SyntaxError,
			);
		});
	});

	describe("octet-stream bodies", () => {
		describe("with a byte body", () => {
			let result: unknown;

			beforeAll(async () => {
				result = await parseBody(
					request(
						new Uint8Array([1, 2, 3]),
						"application/octet-stream",
					),
				);
			});

			it("should return an ArrayBuffer", () => {
				expect(result).toBeInstanceOf(ArrayBuffer);
			});

			it("should preserve the body bytes", () => {
				const bytes = new Uint8Array(result as ArrayBuffer);

				expect(Array.from(bytes)).toEqual([1, 2, 3]);
			});
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

		it("should match a bare trailing semicolon with no parameter", async () => {
			const result = await parseBody(
				request(new Uint8Array([1, 2, 3]), "application/octet-stream;"),
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

		it("should capture valueless keys as empty strings", async () => {
			const result = (await parseBody(
				request("a&b=", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(result).toEqual({ a: "", b: "" });
		});

		it("should keep an empty field name as an empty string key", async () => {
			const result = (await parseBody(
				request("=v1&a=v2", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			// this diverges from parseCookies, which drops nameless pairs on purpose
			expect(Object.keys(result)).toEqual(["", "a"]);
			expect(Object.hasOwn(result, "")).toBe(true);
			expect(result[""]).toBe("v1");
			expect(result.a).toBe("v2");
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

		it("should match a bare trailing semicolon with no parameter", async () => {
			const result = (await parseBody(
				request("a=v1", "application/x-www-form-urlencoded;"),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1");
		});

		it("should resolve to an empty dictionary for an empty urlencoded body", async () => {
			const result = await parseBody(
				request("", "application/x-www-form-urlencoded"),
			);

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result as object)).toHaveLength(0);
		});

		it("should decode percent escapes and '+' in field names", async () => {
			const result = (await parseBody(
				request("a%20b=v1&c+d=v2", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(Object.hasOwn(result, "a b")).toBe(true);
			expect(result["a b"]).toBe("v1");
			expect(Object.hasOwn(result, "c d")).toBe(true);
			expect(result["c d"]).toBe("v2");
		});

		it("should decode a percent-escaped unicode field name into its character", async () => {
			const result = (await parseBody(
				request("%F0%9F%99%82=v1", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(Object.keys(result)).toEqual(["🙂"]);
			expect(result["🙂"]).toBe("v1");
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

		it("should collapse a repeated field mixing a string and a File into an array in first-seen order", async () => {
			const formData = new FormData();

			formData.append("a", "v1");
			formData.append(
				"a",
				new File(["v2"], "a.txt", { type: "text/plain" }),
			);

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

			const values = result.a as [string, File];

			expect(values).toHaveLength(2);
			expect(values[0]).toBe("v1");
			expect(values[1]).toBeInstanceOf(File);
			expect(values[1]?.name).toBe("a.txt");
		});

		it("should parse a hand written multipart body with its boundary", async () => {
			const boundary = "a1b2c3";
			const body = [
				`--${boundary}`,
				'Content-Disposition: form-data; name="a"',
				"",
				"v1",
				`--${boundary}`,
				'Content-Disposition: form-data; name="b"',
				"",
				"v2",
				`--${boundary}--`,
				"",
			].join("\r\n");

			const result = (await parseBody(
				request(body, `multipart/form-data; boundary=${boundary}`),
			)) as Record<string, unknown>;

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toEqual(["a", "b"]);
			expect(result.a).toBe("v1");
			expect(result.b).toBe("v2");
		});

		it("should recognize a non canonical media type spelling and let Bun reject it", async () => {
			const boundary = "a1b2c3";
			const body = [
				`--${boundary}`,
				'Content-Disposition: form-data; name="a"',
				"",
				"v1",
				`--${boundary}--`,
				"",
			].join("\r\n");

			// formData() checks the header again case-sensitively and throws.
			// Rejecting is what proves the media type was matched here: an
			// unrecognized type falls back to text() and resolves instead, as
			// "multipart/form-datax" does further down.
			await expect(
				parseBody(
					request(body, `Multipart/Form-Data; boundary=${boundary}`),
				),
			).rejects.toThrow(TypeError);

			expect(
				await parseBody(
					request(body, `multipart/form-data; boundary=${boundary}`),
				),
			).toEqual({ a: "v1" });
		});

		it("should drop an empty field name, unlike the urlencoded branch", async () => {
			const formData = new FormData();

			formData.append("", "v1");
			formData.append("a", "v2");

			const result = (await parseBody(request(formData))) as Record<
				string,
				unknown
			>;

			// the nameless part never survives the multipart decoding round trip
			expect(Object.keys(result)).toEqual(["a"]);
			expect(Object.hasOwn(result, "")).toBe(false);
			expect(result.a).toBe("v2");
		});

		it("should reject with a TypeError for 'multipart/form-data' without a boundary parameter", async () => {
			// a TypeError, not the SyntaxError the json branch would raise for "v1"
			await expect(
				parseBody(request("v1", "multipart/form-data")),
			).rejects.toThrow(TypeError);
		});

		it("should enter the multipart branch for a bare trailing semicolon (then reject with a TypeError without a boundary)", async () => {
			await expect(
				parseBody(request("v1", "multipart/form-data;")),
			).rejects.toThrow(TypeError);
		});

		it("should resolve to an empty dictionary for a multipart body with no entries", async () => {
			const result = await parseBody(request(new FormData()));

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result as object)).toHaveLength(0);
		});
	});

	describe("text and fallback bodies", () => {
		it("should read the body as text when there is no content type", async () => {
			const result = await parseBody(request("v1"));

			expect(result).toBe("v1");
		});

		it("should resolve to an empty string for a bodyless request with no content type", async () => {
			const bodylessRequest = new Request("https://a.b/c");

			expect(bodylessRequest.headers.get("content-type")).toBeNull();
			expect(await parseBody(bodylessRequest)).toBe("");
		});

		it("should read a byte body as text when no content type is set", async () => {
			const byteBodyRequest = request(new Uint8Array([104, 105]));

			expect(byteBodyRequest.headers.get("content-type")).toBeNull();
			expect(await parseBody(byteBodyRequest)).toBe("hi");
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

		it("should match the media type case-insensitively", async () => {
			expect(
				await parseBody(
					request(JSON.stringify({ a: "v1" }), "APPLICATION/JSON"),
				),
			).toEqual({ a: "v1" });

			expect(
				await parseBody(
					request(JSON.stringify({ a: "v1" }), "Application/Json"),
				),
			).toEqual({ a: "v1" });

			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/JSON;charset=utf-8",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should match a case-insensitive octet-stream type", async () => {
			const result = await parseBody(
				request("v1", "Application/Octet-Stream"),
			);

			expect(result).toBeInstanceOf(ArrayBuffer);
		});

		it("should match a case-insensitive urlencoded type and let Bun reject it", async () => {
			await expect(
				parseBody(request("a=v1", "APPLICATION/X-WWW-FORM-URLENCODED")),
			).rejects.toThrow(TypeError);

			expect(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencoded"),
				),
			).toEqual({ a: "v1" });
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

		it("should ignore optional whitespace before the parameter semicolon", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json ; charset=utf-8",
					),
				),
			).toEqual({ a: "v1" });

			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json\t;charset=utf-8",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should fall back to text for a content type shorter than every match window", async () => {
			expect(await parseBody(request("v1", "a"))).toBe("v1");
			expect(await parseBody(request("v1", "m"))).toBe("v1");
		});

		it("should fall back to text for a non-json type whose length equals the json match window", async () => {
			// "application/abcd" is as long as "application/json", so the length
			// guard alone cannot reject it
			const contentType = "application/abcd";

			expect(await parseBody(request("v1", contentType))).toBe("v1");
		});

		it("should fall back to text for a non-octet-stream type whose length equals the octet-stream match window", async () => {
			// "application/vnd.ms-excel" is as long as "application/octet-stream",
			// so the length guard alone cannot reject it
			const contentType = "application/vnd.ms-excel";

			expect(await parseBody(request("v1", contentType))).toBe("v1");
		});

		it("should fall back to text for a non-urlencoded type whose length equals the urlencoded match window", async () => {
			// "application/x-www-form-urlencodeX" is as long as
			// "application/x-www-form-urlencoded", so the length guard alone
			// cannot reject it
			const contentType = "application/x-www-form-urlencodeX";

			expect(await parseBody(request("a=v1", contentType))).toBe("a=v1");
		});

		it("should fall back to text for a non-form-data multipart type whose length equals the form-data match window", async () => {
			// "multipart/form-dat0" is as long as "multipart/form-data", so the
			// length guard alone cannot reject it
			const contentType = "multipart/form-dat0";

			expect(await parseBody(request("v1", contentType))).toBe("v1");
		});
	});

	describe("dangerous field names", () => {
		it("should store a json `__proto__` key as a real own key without polluting the prototype", async () => {
			const result = (await parseBody(
				request(
					'{"__proto__":{"polluted":"yes"},"a":"v1"}',
					"application/json",
				),
			)) as Record<string, unknown>;

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(
				Object.getOwnPropertyDescriptor(result, "__proto__")?.value,
			).toEqual({ polluted: "yes" });
			expect(result.a).toBe("v1");
			const objectPrototype = Object.prototype as unknown as Record<
				string,
				unknown
			>;

			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(objectPrototype.polluted).toBeUndefined();
		});

		it("should store a json `constructor` key as a real own key without invoking inheritance", async () => {
			const result = (await parseBody(
				request('{"constructor":"v1","a":"v2"}', "application/json"),
			)) as Record<string, unknown>;

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
			expect(result.a).toBe("v2");
		});

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
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(result)),
			).toBeNull();
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
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(result)),
			).toBeNull();
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

		describe("with a json body", () => {
			let result: object;

			beforeAll(async () => {
				result = (await parseBody(
					request(JSON.stringify({ a: "v1" }), "application/json"),
				)) as object;
			});

			it("should not return a dictionary inheriting from Empty", () => {
				expect(result).not.toBeInstanceOf(Empty);
			});

			it("should inherit from Object.prototype, unlike form bodies", () => {
				expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
				expect("toString" in result).toBe(true);
				expect("hasOwnProperty" in result).toBe(true);
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
