import { beforeAll, describe, expect, it } from "bun:test";

import { parseBody } from "@/utils/bodies/parse-body";

const request = (body: BodyInit, contentType?: string): Request =>
	new Request(
		"http://localhost/a",
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
			expect(
				await parseBody(
					request(JSON.stringify(["v1", "v2"]), "application/json"),
				),
			).toEqual(["v1", "v2"]);
		});

		it("should parse a primitive number body", async () => {
			expect(await parseBody(request("1", "application/json"))).toBe(1);
		});

		it("should parse a primitive null body", async () => {
			expect(
				await parseBody(request("null", "application/json")),
			).toBeNull();
		});

		it("should match when a charset parameter trails the content type", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json; charset=utf-8",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should reject when the json body is malformed", async () => {
			await expect(
				parseBody(request("{a", "application/json")),
			).rejects.toThrow();
		});

		it("should match a bare trailing semicolon with no parameter", async () => {
			expect(
				await parseBody(
					request(JSON.stringify({ a: "v1" }), "application/json;"),
				),
			).toEqual({ a: "v1" });
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
				expect([...new Uint8Array(result as ArrayBuffer)]).toEqual([
					1, 2, 3,
				]);
			});
		});

		it("should match when a parameter trails the octet-stream content type", async () => {
			expect(
				await parseBody(
					request(
						new Uint8Array([1, 2, 3]),
						"application/octet-stream; charset=binary",
					),
				),
			).toBeInstanceOf(ArrayBuffer);
		});

		it("should match a bare trailing semicolon with no parameter", async () => {
			expect(
				await parseBody(
					request(
						new Uint8Array([1, 2, 3]),
						"application/octet-stream;",
					),
				),
			).toBeInstanceOf(ArrayBuffer);
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
			expect(
				await parseBody(
					request("a&b=", "application/x-www-form-urlencoded"),
				),
			).toEqual({ a: "", b: "" });
		});

		it("should keep an empty field name as an empty string key", async () => {
			const result = (await parseBody(
				request("=v1&a=v2", "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

			expect(Object.keys(result)).toEqual(["", "a"]);
			expect(Object.hasOwn(result, "")).toBe(true);
			expect(result[""]).toBe("v1");
			expect(result.a).toBe("v2");
		});

		it("should decode percent escapes and '+' in field values", async () => {
			const result = (await parseBody(
				request(
					"a=v1%20v2&b=v3+v4",
					"application/x-www-form-urlencoded",
				),
			)) as Record<string, unknown>;

			expect(result.a).toBe("v1 v2");
			expect(result.b).toBe("v3 v4");
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

			expect(Object.getPrototypeOf(result)).toBeNull();
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

			const files = (
				(await parseBody(request(formData))) as Record<string, unknown>
			).a as File[];

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

			const values = (
				(await parseBody(request(formData))) as Record<string, unknown>
			).a as [string, File];

			expect(values).toHaveLength(2);
			expect(values[0]).toBe("v1");
			expect(values[1]).toBeInstanceOf(File);
			expect(values[1]?.name).toBe("a.txt");
		});

		it("should parse a hand written multipart body with its boundary", async () => {
			const boundary = "v3";
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

			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(Object.keys(result)).toEqual(["a", "b"]);
			expect(result.a).toBe("v1");
			expect(result.b).toBe("v2");
		});

		it("should recognize a non canonical media type spelling", async () => {
			const boundary = "v2";
			const body = [
				`--${boundary}`,
				'Content-Disposition: form-data; name="a"',
				"",
				"v1",
				`--${boundary}--`,
				"",
			].join("\r\n");

			expect(
				await parseBody(
					request(body, `Multipart/Form-Data; boundary=${boundary}`),
				),
			).toEqual({ a: "v1" });
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

			expect(Object.keys(result)).toEqual(["a"]);
			expect(Object.hasOwn(result, "")).toBe(false);
			expect(result.a).toBe("v2");
		});

		it("should reject with a TypeError for 'multipart/form-data' without a boundary parameter", async () => {
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

			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(Object.keys(result as object)).toHaveLength(0);
		});
	});

	describe("text and fallback bodies", () => {
		it("should read the body as text when there is no content type", async () => {
			expect(await parseBody(request("v1"))).toBe("v1");
		});

		it("should resolve to an empty string for a bodyless request with no content type", async () => {
			const bodylessRequest = new Request("http://localhost/a");

			expect(bodylessRequest.headers.get("content-type")).toBeNull();
			expect(await parseBody(bodylessRequest)).toBe("");
		});

		it("should read a byte body as text when no content type is set", async () => {
			const byteBodyRequest = request(new Uint8Array([118, 49]));

			expect(byteBodyRequest.headers.get("content-type")).toBeNull();
			expect(await parseBody(byteBodyRequest)).toBe("v1");
		});

		it("should read the body as text for an unknown content type", async () => {
			expect(await parseBody(request("v1", "text/plain"))).toBe("v1");
		});

		it("should read the body as text for an unhandled 'application/*' type", async () => {
			expect(
				await parseBody(request("<a>v1</a>", "application/xml")),
			).toBe("<a>v1</a>");
		});

		it("should read the body as text for a 'multipart/*' type that is not form-data", async () => {
			expect(await parseBody(request("v1", "multipart/mixed"))).toBe(
				"v1",
			);
		});
	});

	describe("content-type matching precision", () => {
		it("should not treat a longer look-alike type as json", async () => {
			expect(
				await parseBody(
					request(JSON.stringify({ a: "v1" }), "application/json5"),
				),
			).toBe(JSON.stringify({ a: "v1" }));
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
			expect(
				await parseBody(request("v1", "Application/Octet-Stream")),
			).toBeInstanceOf(ArrayBuffer);
		});

		it("should match a case-insensitive urlencoded type", async () => {
			expect(
				await parseBody(
					request("a=v1", "APPLICATION/X-WWW-FORM-URLENCODED"),
				),
			).toEqual({ a: "v1" });
			expect(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencoded"),
				),
			).toEqual({ a: "v1" });
		});

		it("should not treat a longer look-alike type as a urlencoded form", async () => {
			expect(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencodedx"),
				),
			).toBe("a=v1");
		});

		it("should not treat a longer look-alike type as a multipart form", async () => {
			expect(await parseBody(request("v1", "multipart/form-datax"))).toBe(
				"v1",
			);
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
			expect(await parseBody(request("v1", "application/abcd"))).toBe(
				"v1",
			);
		});

		it("should fall back to text for a non-octet-stream type whose length equals the octet-stream match window", async () => {
			expect(
				await parseBody(request("v1", "application/vnd.ms-excel")),
			).toBe("v1");
		});

		it("should fall back to text for a non-urlencoded type whose length equals the urlencoded match window", async () => {
			expect(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencodeX"),
				),
			).toBe("a=v1");
		});

		it("should not accept a control character folded onto a separator", async () => {
			// "| 32" maps "\u000F" onto "/" and "\r" onto "-"
			for (const contentType of [
				"application\u000Fjson",
				"application\u000Foctet-stream",
				"application/x\rwww\rform\rurlencoded",
				"multipart/form\rdata",
			]) {
				let request: Request;

				try {
					request = new Request("http://localhost/a", {
						body: "v1",
						headers: { "content-type": contentType },
						method: "POST",
					});
				} catch {
					// "\r" is rejected by Headers
					continue;
				}

				expect(await parseBody(request)).toBe("v1");
			}
		});

		it("should fall back to text for a non-form-data multipart type whose length equals the form-data match window", async () => {
			expect(await parseBody(request("v1", "multipart/form-dat0"))).toBe(
				"v1",
			);
		});
	});

	describe("joined duplicate content types", () => {
		// Bun joins duplicate request headers with ", "
		it("should match json when a duplicate header repeats the same type", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json, application/json",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should match the first type when a duplicate header adds a different one", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json, text/plain",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should stop at the earlier of the parameter and list separators", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json;charset=utf-8, application/json",
					),
				),
			).toEqual({ a: "v1" });
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json, application/json;charset=utf-8",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should trim the whitespace a joined list leaves before the separator", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json , text/plain",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should match a duplicated octet-stream type", async () => {
			expect(
				await parseBody(
					request(
						"v1",
						"application/octet-stream, application/octet-stream",
					),
				),
			).toBeInstanceOf(ArrayBuffer);
		});

		it("should match a duplicated urlencoded type", async () => {
			expect(
				await parseBody(
					request(
						"a=v1",
						"application/x-www-form-urlencoded, application/x-www-form-urlencoded",
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should still fall back to text when no entry of the list matches", async () => {
			expect(
				await parseBody(request("v1", "text/plain, application/json")),
			).toBe("v1");
		});

		it("should not treat a type whose name contains a comma as a match", async () => {
			expect(
				await parseBody(
					request(JSON.stringify({ a: "v1" }), ",application/json"),
				),
			).toBe(JSON.stringify({ a: "v1" }));
		});
	});

	describe("dangerous field names", () => {
		it("should store a json `__proto__` key as a real own key without polluting the prototype", async () => {
			const result = (await parseBody(
				request(
					'{"__proto__":{"a":"v1"},"a":"v2"}',
					"application/json",
				),
			)) as Record<string, unknown>;

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(
				Object.getOwnPropertyDescriptor(result, "__proto__")?.value,
			).toEqual({ a: "v1" });
			expect(result.a).toBe("v2");
			expect(({} as Record<string, unknown>).a).toBeUndefined();
			expect(
				(Object.prototype as unknown as Record<string, unknown>).a,
			).toBeUndefined();
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
			expect(Object.getPrototypeOf(result)).toBeNull();
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
			expect(Object.getPrototypeOf(result)).toBeNull();
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

			it("should return a null-prototype dictionary", () => {
				expect(Object.getPrototypeOf(result)).toBeNull();
			});

			it("should inherit no Object.prototype methods", () => {
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

			it("should not return a null-prototype dictionary", () => {
				expect(Object.getPrototypeOf(result)).not.toBeNull();
			});

			it("should inherit from Object.prototype, unlike form bodies", () => {
				expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
				expect("toString" in result).toBe(true);
				expect("hasOwnProperty" in result).toBe(true);
			});
		});

		it("should return a fresh dictionary on each call", async () => {
			expect(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencoded"),
				),
			).not.toBe(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencoded"),
				),
			);
		});
	});

	describe("bun header semantics", () => {
		// bun joins duplicate headers with ", " and reads an empty one as ""
		const appended = (
			body: BodyInit,
			values: readonly string[],
		): Request => {
			const headers = new Headers();

			for (const value of values) {
				headers.append("content-type", value);
			}

			return new Request("http://localhost/a", {
				body,
				headers,
				method: "POST",
			});
		};

		it("should join duplicate content types with ', '", () => {
			const headers = new Headers();

			headers.append("content-type", "application/json");
			headers.append("content-type", "text/plain");

			expect(headers.get("content-type")).toBe(
				"application/json, text/plain",
			);
		});

		it("should match the first type of a joined duplicate header", async () => {
			expect(
				await parseBody(
					appended(JSON.stringify({ a: "v1" }), [
						"application/json",
						"text/plain",
					]),
				),
			).toEqual({ a: "v1" });
		});

		it("should fall back to text when the first joined type is not known", async () => {
			expect(
				await parseBody(
					appended("v1", ["text/plain", "application/json"]),
				),
			).toBe("v1");
		});

		it("should read a single empty content type as an empty string", () => {
			const headers = new Headers();

			headers.append("content-type", "");

			expect(headers.get("content-type")).toBe("");
		});

		it("should fall back to text on an empty content type", async () => {
			expect(await parseBody(appended("v1", [""]))).toBe("v1");
		});

		it("should fall back to text on a joined pair of empty content types", async () => {
			expect(await parseBody(appended("v1", ["", ""]))).toBe("v1");
		});

		it("should match json when an empty value precedes it", async () => {
			const headers = new Headers();

			headers.append("content-type", "");
			headers.append("content-type", "application/json");

			// the join leaves a leading ", "
			expect(headers.get("content-type")).toBe(", application/json");
			expect(
				await parseBody(
					new Request("http://localhost/a", {
						body: JSON.stringify({ a: "v1" }),
						headers,
						method: "POST",
					}),
				),
			).toBe('{"a":"v1"}');
		});

		it("should read the content type a server received over the wire", async () => {
			const server = Bun.serve({
				development: false,
				fetch: async (received) =>
					Response.json({
						body: await parseBody(received),
						contentType: received.headers.get("content-type"),
					}),
				port: 0,
			});

			const response = await fetch(`http://localhost:${server.port}/a`, {
				body: JSON.stringify({ a: "v1" }),
				headers: [
					["content-type", "application/json"],
					["content-type", "application/json"],
				],
				method: "POST",
			});

			expect(await response.json()).toEqual({
				body: { a: "v1" },
				contentType: "application/json, application/json",
			});

			server.stop(true);
		});
	});

	describe("media type terminators", () => {
		it("should skip a run of mixed spaces and tabs before the separator", async () => {
			expect(
				await parseBody(
					request(
						JSON.stringify({ a: "v1" }),
						"application/json \t \t;charset=utf-8",
					),
				),
			).toEqual({ a: "v1" });
			expect(
				await parseBody(
					request("a=v1", "application/x-www-form-urlencoded\t ,a/b"),
				),
			).toEqual({ a: "v1" });
		});

		it("should fall back to text when whitespace is followed by another token", async () => {
			expect(
				await parseBody(
					request("v1", "application/json charset=utf-8"),
				),
			).toBe("v1");
		});

		it("should fall back to text for whitespace other than space and tab before the separator", async () => {
			expect(
				await parseBody(request("v1", "application/json\u000B;")),
			).toBe("v1");
			expect(await parseBody(request("v1", "application/json ;"))).toBe(
				"v1",
			);
		});

		it("should fall back to text for a latin-1 character after the type", async () => {
			expect(await parseBody(request("v1", "application/jsoné"))).toBe(
				"v1",
			);
			expect(await parseBody(request("v1", "multipart/form-dataÿ"))).toBe(
				"v1",
			);
		});

		it("should fall back to text for structured suffix and look-alike json types", async () => {
			for (const contentType of [
				"application/ld+json",
				"application/json+a",
				"application/json-seq",
				"application/json/a",
				"text/json",
				"application /json",
				"application/ json",
				"xapplication/json",
			]) {
				expect(await parseBody(request("v1", contentType))).toBe("v1");
			}
		});

		it("should fall back to text when a known type is not the first list entry", async () => {
			for (const contentType of [
				"a/b, application/octet-stream",
				"a/b, application/x-www-form-urlencoded",
				"a/b, multipart/form-data; boundary=v2",
			]) {
				expect(await parseBody(request("v1", contentType))).toBe("v1");
			}
		});

		it("should match a multipart type with whitespace before its boundary parameter", async () => {
			const boundary = "v2";
			const body = [
				`--${boundary}`,
				'Content-Disposition: form-data; name="a"',
				"",
				"v1",
				`--${boundary}--`,
				"",
			].join("\r\n");

			expect(
				await parseBody(
					request(
						body,
						`multipart/form-data \t \t; boundary=${boundary}`,
					),
				),
			).toEqual({ a: "v1" });
		});

		it("should match an octet-stream type before a run of spaces and tabs", async () => {
			expect(
				await parseBody(
					request("v1", "application/octet-stream \t \t;a=b"),
				),
			).toBeInstanceOf(ArrayBuffer);
		});

		it("should enter the multipart branch for a comma separator", async () => {
			await expect(
				parseBody(request("v1", "multipart/form-data, a/b")),
			).rejects.toThrow(TypeError);
		});

		it("should fall back to text for a binary or form type followed by a non-separator", async () => {
			for (const type of [
				"application/octet-stream",
				"application/x-www-form-urlencoded",
				"multipart/form-data",
			]) {
				for (const tail of [" a", "\u000B;", "+a"]) {
					expect(
						await parseBody(request("v1", `${type}${tail}`)),
					).toBe("v1");
				}
			}
		});
	});

	describe("urlencoded parsing details", () => {
		const urlencoded = async (
			body: BodyInit,
		): Promise<Record<string, unknown>> =>
			(await parseBody(
				request(body, "application/x-www-form-urlencoded"),
			)) as Record<string, unknown>;

		it("should keep everything after the first '=' as the value", async () => {
			expect(await urlencoded("a=v1=v2&b==")).toEqual({
				a: "v1=v2",
				b: "=",
			});
		});

		it("should skip empty pairs", async () => {
			expect(Object.keys(await urlencoded("&&a=v1&&b=v2&"))).toEqual([
				"a",
				"b",
			]);
		});

		it("should keep a leading '?' and a ';' as plain characters", async () => {
			expect(await urlencoded("?a=v1;b=v2&c;d=v3")).toEqual({
				"?a": "v1;b=v2",
				"c;d": "v3",
			});
		});

		it("should keep malformed percent escapes verbatim", async () => {
			expect(await urlencoded("a=%ZZ&b=%&c=%4")).toEqual({
				a: "%ZZ",
				b: "%",
				c: "%4",
			});
		});

		it("should replace invalid utf-8 with the replacement character", async () => {
			expect(await urlencoded("a=%E0%A4&b=%FF")).toEqual({
				a: "�",
				b: "�",
			});
		});

		it("should decode an escaped NUL and escaped separators into the value", async () => {
			expect(await urlencoded("a=%00&b=%26%3D%2B")).toEqual({
				a: "\u0000",
				b: "&=+",
			});
		});

		it("should collapse repeated empty values into an array", async () => {
			expect(await urlencoded("a=&a=&a")).toEqual({ a: ["", "", ""] });
		});

		it("should keep a leading '?' next to a malformed percent escape", async () => {
			expect(await urlencoded("?a=%ZZ&?b=v1")).toEqual({
				"?a": "%ZZ",
				"?b": "v1",
			});
		});

		it("should replace '+' before decoding an escaped '+'", async () => {
			expect(await urlencoded("a=%2B+&%2B+=v1")).toEqual({
				"+ ": "v1",
				a: "+ ",
			});
		});
	});

	describe("multipart parsing details", () => {
		it("should collapse repeated empty values into an array", async () => {
			const formData = new FormData();

			formData.append("a", "");
			formData.append("a", "");
			formData.append("a", "");

			expect(await parseBody(request(formData))).toEqual({
				a: ["", "", ""],
			});
		});
	});
});
