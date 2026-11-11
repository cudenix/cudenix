import { beforeAll, describe, expect, it } from "bun:test";

import { decodePathParam } from "@/utils/urls/decode-path-param";
import { parseQuery } from "@/utils/urls/parse-query";

const searchParams = (query: string): Record<string, unknown> => {
	const params: Record<string, unknown> = {};

	for (const [key, value] of new URLSearchParams(query)) {
		const existing = params[key];

		if (existing === undefined) {
			params[key] = value;
		} else if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			params[key] = [existing, value];
		}
	}

	return params;
};

describe("parseQuery", () => {
	describe("typical query strings", () => {
		describe("with single pair '?b=v1'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1");
			});

			it("should capture the parameter value", () => {
				expect(result.b).toBe("v1");
			});

			it("should expose only the parsed parameter key", () => {
				expect(Object.keys(result)).toEqual(["b"]);
			});
		});

		describe("with two pairs '?b=v1&c=v2'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1&c=v2");
			});

			it("should capture the first parameter value", () => {
				expect(result.b).toBe("v1");
			});

			it("should capture the second parameter value", () => {
				expect(result.c).toBe("v2");
			});

			it("should preserve insertion order of the parameter names", () => {
				expect(Object.keys(result)).toEqual(["b", "c"]);
			});
		});

		it("should support many parameters in a single query string", () => {
			expect(parseQuery("/a?b=1&c=2&d=3&e=4&f=5")).toEqual({
				b: "1",
				c: "2",
				d: "3",
				e: "4",
				f: "5",
			});
		});

		it("should read the query from a full absolute URL", () => {
			expect(parseQuery("http://localhost/a?b=v1&c=v2")).toEqual({
				b: "v1",
				c: "v2",
			});
		});
	});

	describe("key and value decoding", () => {
		it("should turn '+' into a space inside a key", () => {
			expect(parseQuery("/a?b+c=v1")["b c"]).toBe("v1");
		});

		it("should turn '+' into a space inside a value", () => {
			expect(parseQuery("/a?b=v1+v2").b).toBe("v1 v2");
		});

		it("should decode '%xx' escapes inside a key", () => {
			expect(parseQuery("/a?b%20c=v1")["b c"]).toBe("v1");
		});

		it("should keep a key that is non-empty raw but decodes to whitespace", () => {
			const result = parseQuery("/a?%20=v1");

			expect(Object.hasOwn(result, " ")).toBe(true);
			expect(result[" "]).toBe("v1");
		});

		it("should decode '%xx' escapes inside a value", () => {
			expect(parseQuery("/a?b=v1%20v2").b).toBe("v1 v2");
		});

		it("should apply both '+' and '%xx' decoding to the same key", () => {
			expect(parseQuery("/a?b+c%21=v1")["b c!"]).toBe("v1");
		});

		it("should apply both '+' and '%xx' decoding to the same value", () => {
			expect(parseQuery("/a?b=v1+v2%21").b).toBe("v1 v2!");
		});

		it("should preserve non-ASCII characters in keys and values", () => {
			const result = parseQuery("/a?café=☕&b=v1");

			expect(result.café).toBe("☕");
			expect(result.b).toBe("v1");
		});

		it("should preserve surrogate-pair characters (codepoints outside the BMP)", () => {
			const result = parseQuery("/a?b=𝕊&c=😀");

			expect(result.b).toBe("𝕊");
			expect(result.c).toBe("😀");
		});

		it("should keep additional '=' characters as part of the value", () => {
			expect(parseQuery("/a?b=v1=v2").b).toBe("v1=v2");
		});

		it("should decode '%2B' to a literal '+' in a value (decode runs after '+' replacement)", () => {
			expect(parseQuery("/a?b=1%2B2").b).toBe("1+2");
		});

		it("should decode '%2B' to a literal '+' in a key", () => {
			expect(parseQuery("/a?b%2Bc=v1")["b+c"]).toBe("v1");
		});

		it("should decode percent-escapes exactly once (no double decode)", () => {
			expect(parseQuery("/a?b=%252B").b).toBe("%2B");
		});

		it("should keep a '?' after the first one as literal data in a value", () => {
			expect(parseQuery("/a?b=v1?v2").b).toBe("v1?v2");
		});

		it("should keep a '?' after the first one as literal data in a key", () => {
			expect(parseQuery("/a?b?c=v1")["b?c"]).toBe("v1");
		});

		it("should decode '%26' and '%3D' into the value without splitting the pair", () => {
			expect(parseQuery("/a?b=1%262%3D3")).toEqual({ b: "1&2=3" });
		});

		it("should decode '%23' into the value without truncating at a fragment", () => {
			expect(parseQuery("/a?b=1%232&c=2")).toEqual({ b: "1#2", c: "2" });
		});
	});

	describe("malformed percent-escapes", () => {
		it("should keep a bare '%' in a value verbatim instead of throwing", () => {
			const result = parseQuery("/a?b=v1%&c=v2");

			expect(result.b).toBe("v1%");
			expect(result.c).toBe("v2");
		});

		it("should keep a non-hex '%' escape in a value verbatim", () => {
			expect(parseQuery("/a?b=%zz").b).toBe("%zz");
		});

		it("should keep a malformed '%' escape in a key verbatim", () => {
			expect(parseQuery("/a?b%=v1")["b%"]).toBe("v1");
		});

		it("should replace a truncated multibyte escape instead of throwing", () => {
			expect(parseQuery("/a?b=%E0%A4%A").b).toBe("\uFFFD%A");
		});

		it("should keep the plus-replaced value when a '%' escape is malformed", () => {
			expect(parseQuery("/a?b=v1+v2%").b).toBe("v1 v2%");
		});

		it("should keep the plus-replaced key when a '%' escape is malformed", () => {
			expect(parseQuery("/a?b+c%=v1")["b c%"]).toBe("v1");
		});

		it("should replace a syntactically valid escape carrying invalid UTF-8", () => {
			const result = parseQuery("/a?b=%FF&c=v2");

			expect(result.b).toBe("\uFFFD");
			expect(result.c).toBe("v2");
		});

		it("should replace invalid UTF-8 in a key too", () => {
			expect(parseQuery("/a?b%FF=v1")["b\uFFFD"]).toBe("v1");
		});

		it("should still decode the well-formed escapes beside a malformed one", () => {
			expect(parseQuery("/a?b=x%FFy%20z").b).toBe("x\uFFFDy z");
			expect(parseQuery("/a?b=%ZZ%20").b).toBe("%ZZ ");
		});

		it("should reach the JSON branch once the fallback decoder runs", () => {
			expect(parseQuery("/a?b=%7B%22c%22%3A%221%FF%22%7D").b).toEqual({
				c: "1\uFFFD",
			});
		});

		it("should collapse two malformed spellings of one key into an array", () => {
			expect(parseQuery("/a?b%FF=v1&b%EF%BF%BD=v2")["b\uFFFD"]).toEqual([
				"v1",
				"v2",
			]);
		});

		it("should keep a non-hex escape literal, unlike path params", () => {
			expect(parseQuery("/a?b=%ZZ").b).toBe("%ZZ");
			expect(decodePathParam("%ZZ")).toBe("�");
		});

		it("should replace per maximal subpart, unlike path params", () => {
			expect(parseQuery("/a?b=%ED%A0%80").b).toBe("���");
			expect(decodePathParam("%ED%A0%80")).toBe("�");
		});
	});

	describe("JSON-shaped values", () => {
		it("should parse a value wrapped in '{...}' as an object", () => {
			expect(parseQuery('/a?b={"c":1}').b).toEqual({ c: 1 });
		});

		it("should parse a value wrapped in '[...]' as an array", () => {
			expect(parseQuery("/a?b=[1,2,3]").b).toEqual([1, 2, 3]);
		});

		it("should parse a percent-encoded JSON object", () => {
			expect(parseQuery("/a?b=%7B%22c%22%3A1%7D").b).toEqual({ c: 1 });
		});

		it("should fall back to the raw string when JSON parsing fails", () => {
			expect(parseQuery("/a?b={c}").b).toBe("{c}");
		});

		it("should keep the raw string when a percent-decode failure leaves JSON-shaped text", () => {
			expect(parseQuery("/a?b={%zz}").b).toBe("{%zz}");
		});

		it("should not parse a value that opens but never closes a brace", () => {
			expect(parseQuery("/a?b={c").b).toBe("{c");
		});

		it("should not parse a value that opens but never closes a bracket", () => {
			expect(parseQuery("/a?b=[1").b).toBe("[1");
		});

		it("should not parse a value whose brackets are mismatched", () => {
			expect(parseQuery("/a?b={1]").b).toBe("{1]");
		});

		it("should parse an empty JSON object value", () => {
			expect(parseQuery("/a?b={}").b).toEqual({});
		});

		it("should parse an empty JSON array value", () => {
			expect(parseQuery("/a?b=[]").b).toEqual([]);
		});

		it("should keep a lone '{' or '[' as a string", () => {
			expect(parseQuery("/a?b={").b).toBe("{");
			expect(parseQuery("/a?b=[").b).toBe("[");
		});

		it("should turn '+' into a space inside a JSON string before parsing", () => {
			expect(parseQuery('/a?b={"c":"1+2"}').b).toEqual({ c: "1 2" });
		});

		it("should preserve a literal '+' inside a JSON string when written as '%2B'", () => {
			expect(parseQuery('/a?b={"c":"1%2B2"}').b).toEqual({ c: "1+2" });
		});

		it("should split a JSON value on a raw '&' (JSON values must be fully percent-encoded)", () => {
			const result = parseQuery('/a?b={"c":"v1&v2"}');

			expect(result.b).toBe('{"c":"v1');
			expect(result['v2"}']).toBe("");
			expect(Object.keys(result)).toEqual(["b", 'v2"}']);
		});
	});

	describe("keys without a value", () => {
		it("should map a bare key with no '=' to an empty string", () => {
			expect(parseQuery("/a?b").b).toBe("");
		});

		it("should map a key written as 'b=' to an empty string", () => {
			const result = parseQuery("/a?b=&c=v1");

			expect(result.b).toBe("");
			expect(result.c).toBe("v1");
		});

		it("should map a trailing 'b=' at the end of the URL to an empty string", () => {
			expect(parseQuery("/a?b=")).toEqual({ b: "" });
		});

		it("should handle a bare key followed by another pair", () => {
			expect(parseQuery("/a?b&c=v1")).toEqual({ b: "", c: "v1" });
		});

		it("should collapse a bare repeat of an assigned key into an array with an empty string", () => {
			expect(parseQuery("/a?b=v1&b").b).toEqual(["v1", ""]);
		});

		it("should collapse an assigned repeat of a bare key into an array starting with an empty string", () => {
			expect(parseQuery("/a?b&b=v1").b).toEqual(["", "v1"]);
		});

		it("should ignore a trailing '&' separator", () => {
			expect(parseQuery("/a?b=v1&")).toEqual({ b: "v1" });
		});
	});

	describe("fragment handling", () => {
		it("should stop parsing at a '#' fragment after a value", () => {
			const result = parseQuery("/a?b=v1#c");

			expect(result.b).toBe("v1");
			expect("c" in result).toBe(false);
		});

		it("should stop parsing at a '#' fragment that ends a key", () => {
			const result = parseQuery("/a?b#c");

			expect(result.b).toBe("");
			expect(Object.keys(result)).toEqual(["b"]);
		});

		it("should ignore parameters that live in the fragment", () => {
			expect(parseQuery("/a?b=v1#c=v2")).toEqual({ b: "v1" });
		});

		it("should find no query when the '?' sits inside the fragment", () => {
			for (const url of [
				"/a#c?b=v1",
				"http://localhost/a#c?b=v1",
				"http://localhost/a#?b=v1",
			]) {
				expect(parseQuery(url)).toEqual({});
			}
		});

		it("should still read the query when the fragment follows it", () => {
			expect(parseQuery("http://localhost/a?b=v1#c?d=v2")).toEqual({
				b: "v1",
			});
		});
	});

	describe("repeated keys", () => {
		it("should collapse two occurrences into an array in first-seen order", () => {
			expect(parseQuery("/a?b=v1&b=v2").b).toEqual(["v1", "v2"]);
		});

		it("should append further occurrences onto the existing array", () => {
			expect(parseQuery("/a?b=v1&b=v2&b=v3").b).toEqual([
				"v1",
				"v2",
				"v3",
			]);
		});

		it("should wrap a JSON array value as a single element when the key repeats", () => {
			expect(parseQuery("/a?b=[1,2]&b=v3").b).toEqual([[1, 2], "v3"]);
		});

		it("should wrap a JSON object value as a single element when the key repeats", () => {
			expect(parseQuery('/a?b={"c":1}&b=v3').b).toEqual([{ c: 1 }, "v3"]);
		});

		it("should keep repeated JSON array values as distinct elements", () => {
			expect(parseQuery("/a?b=[1,2]&b=[3,4]").b).toEqual([
				[1, 2],
				[3, 4],
			]);
		});

		it("should collapse two independently repeated keys into separate arrays", () => {
			const result = parseQuery("/a?b=1&b=2&c=3&c=4");

			expect(result.b).toEqual(["1", "2"]);
			expect(result.c).toEqual(["3", "4"]);
		});

		it("should collapse differently-encoded spellings of the same key into one array", () => {
			const result = parseQuery("/a?b%20c=1&b+c=2");

			expect(result["b c"]).toEqual(["1", "2"]);
			expect(Object.keys(result)).toEqual(["b c"]);
		});
	});

	describe("entries skipped or dropped", () => {
		it("should drop a leading entry with an empty key ('=v1')", () => {
			const result = parseQuery("/a?=v1&b=v2");

			expect(result).toEqual({ b: "v2" });
			expect(result[""]).toBeUndefined();
		});

		it("should drop an empty-key entry between two valid pairs", () => {
			const result = parseQuery("/a?b=1&=v1&c=2");

			expect(result).toEqual({ b: "1", c: "2" });
			expect(result[""]).toBeUndefined();
		});

		it("should ignore a leading '&' separator", () => {
			expect(parseQuery("/a?&b=v1")).toEqual({ b: "v1" });
		});
	});

	describe("empty or no usable parameters", () => {
		it("should return an empty dictionary when the URL has no '?'", () => {
			const result = parseQuery("/a");

			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should return an empty dictionary for an empty string", () => {
			expect(Object.keys(parseQuery(""))).toHaveLength(0);
		});

		it("should return an empty dictionary for a lone '?'", () => {
			expect(Object.keys(parseQuery("/a?"))).toHaveLength(0);
		});

		it("should return an empty dictionary when only an empty-key pair is present", () => {
			expect(Object.keys(parseQuery("/a?=v1"))).toHaveLength(0);
		});

		it("should return an empty dictionary for a lone '&' separator", () => {
			expect(Object.keys(parseQuery("/a?&"))).toHaveLength(0);
		});

		it("should return an empty dictionary when the query is only a fragment", () => {
			expect(Object.keys(parseQuery("/a?#b"))).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		it("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseQuery("/a?__proto__=v1&b=v2");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			// oxlint-disable-next-line no-proto -- Accessing __proto__ directly for test purposes
			expect(result.__proto__).toBe("v1");
			expect(result.b).toBe("v2");
			expect(Object.getPrototypeOf(result)).toBeNull();
		});

		it("should store `constructor` as a real own key without invoking inheritance", () => {
			const result = parseQuery("/a?constructor=v1&b=v2");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
			expect(result.b).toBe("v2");
		});

		it("should not pollute the prototype when a JSON value carries a `__proto__` key", () => {
			const result = parseQuery('/a?b={"__proto__":{"a":1}}');

			expect(Object.hasOwn(result, "b")).toBe(true);
			expect(Object.getOwnPropertyNames(result.b)).toEqual(["__proto__"]);
			expect(Object.getPrototypeOf(result.b)).toBe(Object.prototype);
		});
	});

	describe("long components", () => {
		const lengths = Array.from({ length: 86 }, (_, i) => i + 55);

		it.each(lengths)(
			"should read a %i character value up to its delimiter",
			(length) => {
				const value = "v".repeat(length);

				expect(parseQuery(`/a?b=${value}`).b).toBe(value);
				expect(parseQuery(`/a?b=${value}&c=v2`).b).toBe(value);
				expect(parseQuery(`/a?b=${value}#f`).b).toBe(value);
			},
		);

		it.each(lengths)(
			"should read a %i character key up to its delimiter",
			(length) => {
				const key = "k".repeat(length);

				expect(parseQuery(`/a?${key}=v1`)[key]).toBe("v1");
				expect(parseQuery(`/a?${key}&c=v2`)[key]).toBe("");
				expect(parseQuery(`/a?${key}`)[key]).toBe("");
			},
		);

		it.each(lengths)(
			"should decode a '+' past character %i of a value",
			(length) => {
				expect(parseQuery(`/a?b=${"v".repeat(length)}+x`).b).toBe(
					`${"v".repeat(length)} x`,
				);
			},
		);

		it.each(lengths)(
			"should decode an escape past character %i of a value",
			(length) => {
				expect(parseQuery(`/a?b=${"v".repeat(length)}%20x`).b).toBe(
					`${"v".repeat(length)} x`,
				);
			},
		);

		it.each(lengths)(
			"should decode a '+' past character %i of a key",
			(length) => {
				expect(
					parseQuery(`/a?${"k".repeat(length)}+x=v1`)[
						`${"k".repeat(length)} x`
					],
				).toBe("v1");
			},
		);

		it("should replace every '+' of a value long enough to take the native swap", () => {
			expect(
				parseQuery(`/a?b=${"a".repeat(200)}+${"b".repeat(200)}+c`).b,
			).toBe(`${"a".repeat(200)} ${"b".repeat(200)} c`);
		});

		it("should decode a long value made only of escapes", () => {
			expect(parseQuery(`/a?b=${"%41".repeat(200)}`).b).toBe(
				"A".repeat(200),
			);
		});

		it("should decode a long value carrying a malformed escape", () => {
			expect(parseQuery(`/a?b=${"a".repeat(200)}%FF`).b).toBe(
				`${"a".repeat(200)}�`,
			);
		});

		it("should stop a long value at the fragment", () => {
			const value = "v".repeat(200);

			expect(parseQuery(`/a?b=${value}#${"f".repeat(200)}`).b).toBe(
				value,
			);
		});

		it("should keep a long key and a long value apart", () => {
			const key = "k".repeat(200);
			const value = "v".repeat(200);

			expect(parseQuery(`/a?${key}=${value}`)[key]).toBe(value);
		});

		it("should parse a pair after a long one", () => {
			const result = parseQuery(`/a?b=${"v".repeat(200)}&c=v2`);

			expect(result.c).toBe("v2");
			expect(Object.keys(result)).toEqual(["b", "c"]);
		});

		it("should collect a long value repeated under one key", () => {
			const value = "v".repeat(200);

			expect(parseQuery(`/a?b=${value}&b=${value}`).b).toEqual([
				value,
				value,
			]);
		});

		it("should collect thousands of long components with no decode markers", () => {
			const values = Array.from({ length: 4096 }, () => "v".repeat(64));

			expect(
				parseQuery(`/a?${values.map((item) => `k=${item}`).join("&")}`)
					.k,
			).toEqual(values);
		});

		it("should keep decode markers and fragments local to each long component", () => {
			const key = "k".repeat(128);
			const value = "v".repeat(128);
			const query = (Array<string>)
				.from({ length: 512 })
				.fill(`${key}=${value}`)
				.join("&");
			const result = parseQuery(
				`/a?${query}&${key}%20x=${value}+%26%3D#ignored=+%20`,
			);

			expect(result[key]).toEqual(
				(Array<string>).from({ length: 512 }).fill(value),
			);
			expect(result[`${key} x`]).toBe(`${value} &=`);
			expect(Object.keys(result)).toEqual([key, `${key} x`]);
		});

		it("should parse a long JSON value", () => {
			expect(parseQuery(`/a?b={"c":"${"x".repeat(200)}"}`).b).toEqual({
				c: "x".repeat(200),
			});
		});

		it("should turn a run of adjacent '+' into the same run of spaces", () => {
			expect(parseQuery("/a?b=a++b").b).toBe("a  b");
			expect(parseQuery("/a?b=+++").b).toBe("   ");
		});

		it("should turn a leading and a trailing '+' into a space", () => {
			expect(parseQuery("/a?b=+a+").b).toBe(" a ");
			expect(parseQuery("/a?+b+=v1")).toEqual({ " b ": "v1" });
		});

		it.each([63, 64, 65, 127, 128, 129, 256])(
			"should turn a %i character run of '+' into the same run of spaces",
			(length) => {
				expect(parseQuery(`/a?b=${"+".repeat(length)}`).b).toBe(
					" ".repeat(length),
				);
			},
		);

		it.each([127, 128, 129, 256])(
			"should swap every '+' of a %i character dense value",
			(length) => {
				expect(
					parseQuery(`/a?b=${"a+".repeat(Math.floor(length / 2))}`).b,
				).toBe("a ".repeat(Math.floor(length / 2)));
			},
		);
	});

	describe("return shape", () => {
		describe("with query '?b=v1'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1");
			});

			it("should return a null-prototype dictionary", () => {
				expect(Object.getPrototypeOf(result)).toBeNull();
			});

			it("should inherit no Object.prototype methods", () => {
				expect("toString" in result).toBe(false);
				expect("hasOwnProperty" in result).toBe(false);
			});
		});

		it("should return a fresh dictionary on each call", () => {
			expect(parseQuery("/a?b=v1")).not.toBe(parseQuery("/a?b=v1"));
		});

		it("should preserve insertion order for non-index names", () => {
			expect(Object.keys(parseQuery("/a?c=1&b=2&d=3"))).toEqual([
				"c",
				"b",
				"d",
			]);
		});

		it("should reorder integer-index names ahead of the rest, per spec", () => {
			const result = parseQuery("/a?2=v1&1=v2&b=v3");

			expect(Object.keys(result)).toEqual(["1", "2", "b"]);
			expect(result[1]).toBe("v2");
			expect(result[2]).toBe("v1");
			expect(result.b).toBe("v3");
		});
	});

	describe("additional edge cases", () => {
		it("should keep JSON primitives as strings", () => {
			expect(parseQuery("/a?b=1").b).toBe("1");
			expect(parseQuery("/a?b=-1.5").b).toBe("-1.5");
			expect(parseQuery("/a?b=true").b).toBe("true");
			expect(parseQuery("/a?b=null").b).toBe("null");
			expect(parseQuery('/a?b="x"').b).toBe('"x"');
		});

		it("should not parse JSON padded by a decoded space", () => {
			expect(parseQuery("/a?b=[1]+").b).toBe("[1] ");
			expect(parseQuery("/a?b=+[1]").b).toBe(" [1]");
			expect(parseQuery("/a?b=[1]%20").b).toBe("[1] ");
			expect(parseQuery("/a?b=%20[1]").b).toBe(" [1]");
		});

		it("should decode lowercase hex escapes", () => {
			expect(parseQuery("/a?b=%2f%2F").b).toBe("//");
			expect(parseQuery("/a?b=%7b%7d").b).toEqual({});
		});

		it("should parse a JSON value that ends at the fragment", () => {
			expect(parseQuery("/a?b=[1,2]#x]")).toEqual({ b: [1, 2] });
		});

		it("should append interleaved repeats to their own key", () => {
			const result = parseQuery("/a?b=1&b=2&b=3&c=4&c=5&c=6&b=7");

			expect(result.b).toEqual(["1", "2", "3", "7"]);
			expect(result.c).toEqual(["4", "5", "6"]);
		});

		it("should collapse a repeated `__proto__` key into an own array", () => {
			const result = parseQuery("/a?__proto__=a&__proto__=b");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			// oxlint-disable-next-line no-proto -- Accessing __proto__ intentionally for test purposes
			expect(result.__proto__).toEqual(["a", "b"]);
			expect(Object.getPrototypeOf(result)).toBeNull();
		});

		it("should map a value cut by an immediate fragment to an empty string", () => {
			expect(parseQuery("/a?b=#")).toEqual({ b: "" });
		});

		it("should read a query with no path before it", () => {
			expect(parseQuery("?b=v1")).toEqual({ b: "v1" });
			expect(Object.keys(parseQuery("?"))).toHaveLength(0);
			expect(Object.keys(parseQuery("#?b=1"))).toHaveLength(0);
		});

		it("should keep a one-digit escape verbatim", () => {
			expect(parseQuery("/a?b=%2&c=%")).toEqual({ b: "%2", c: "%" });
		});

		it("should keep an escaped BOM, with or without the fallback decoder", () => {
			expect(parseQuery("/a?b=%EF%BB%BFx").b).toBe("\uFEFFx");
			expect(parseQuery("/a?b=%EF%BB%BFx%FF").b).toBe("\uFEFFx\uFFFD");
		});

		it("should keep raw non-ASCII characters through the fallback decoder", () => {
			expect(parseQuery("/a?b=é%20").b).toBe("é ");
			expect(parseQuery("/a?b=é%FF").b).toBe("é\uFFFD");
			expect(parseQuery("/a?b=😀%FF").b).toBe("😀\uFFFD");
		});

		it("should keep a lone surrogate unless the fallback decoder runs", () => {
			expect(parseQuery("/a?b=\uD800").b).toBe("\uD800");
			expect(parseQuery("/a?b=\uD800%20").b).toBe("\uD800 ");
			expect(parseQuery("/a?\uD800%20=v1")).toEqual({ "\uD800 ": "v1" });
			expect(parseQuery("/a?b=\uD800%FF").b).toBe("\uFFFD\uFFFD");
		});
	});

	describe("parity with URLSearchParams", () => {
		it.each([
			"b=v1",
			"b=v1&c=v2",
			"b=v1&b=v2",
			"b=v1&b=v2&b=v3",
			"b=",
			"b",
			"b=&c=",
			"b=a+b",
			"b=a%20b",
			"b+c=v1",
			"b%20c=v1",
			"%2F=%2F",
			"b=%2Fa%2Fb",
			"b=Jos%C3%A9",
			"b=%F0%9F%8E%89",
			"b=%E2%82%AC",
			"b=%",
			"b=%z",
			"b=%zz",
			"b=%2",
			"b=a%%20b",
			"b=%C3",
			"b=%ED%A0%80",
			"b=%C0%80",
			"b=%FF",
			"b=%80",
			"b=%F5%80%80%80",
			"&&b=v1&&",
			"b==v2",
			"b=v1&",
			"&b=v1",
			"b=v1&c",
			"b=a&c=b%26c",
			"b=%3D",
			"b=%23",
			"b=v1%2Bv2",
			`b=${"v".repeat(200)}`,
			`${"k".repeat(200)}=v1`,
			`b=${"a+b+".repeat(50)}`,
			`b=${"%20".repeat(50)}`,
		])("should match URLSearchParams for %j", (query) => {
			expect({ ...parseQuery(`/a?${query}`) }).toEqual(
				searchParams(query),
			);
		});

		it("should match URLSearchParams on generated queries", () => {
			const fragments = [
				"b",
				"c",
				"v1",
				"v2",
				"=",
				"&",
				"+",
				"%20",
				"%",
				"%zz",
				"%C3",
				"%C3%A9",
				"%ED%A0%80",
				"%2F",
				"%3D",
				"%26",
				"a",
				"1",
			];

			let seed = 1_234_567;

			const next = (bound: number): number => {
				seed = (seed * 48_271) % 2_147_483_647;

				return seed % bound;
			};

			const differences: {
				cudenix: unknown;
				query: string;
				spec: unknown;
			}[] = [];

			for (let i = 0; i < 3000; i++) {
				const parts = 1 + next(8);

				let query = "";

				for (let part = 0; part < parts; part++) {
					query += fragments[next(fragments.length)];
				}

				if (query.includes("#")) {
					continue;
				}

				const cudenix = { ...parseQuery(`/a?${query}`) };
				const spec = searchParams(query);

				delete spec[""];

				if (!Bun.deepEquals(cudenix, spec, true)) {
					differences.push({ cudenix, query, spec });
				}
			}

			expect(differences).toEqual([]);
		});

		describe("documented divergences", () => {
			it("should parse a json object value URLSearchParams leaves a string", () => {
				expect(parseQuery('/a?b={"c":1}').b).toEqual({ c: 1 });
				expect(searchParams('b={"c":1}').b).toBe('{"c":1}');
			});

			it("should parse a json array value URLSearchParams leaves a string", () => {
				expect(parseQuery("/a?b=[1,2]").b).toEqual([1, 2]);
				expect(searchParams("b=[1,2]").b).toBe("[1,2]");
			});

			it("should parse a percent-encoded json value the same way", () => {
				expect(parseQuery("/a?b=%7B%22c%22%3A1%7D").b).toEqual({
					c: 1,
				});
			});

			it("should drop the empty key URLSearchParams keeps", () => {
				expect(parseQuery("/a?=v1")).toEqual({});
				expect(searchParams("=v1")).toEqual({ "": "v1" });
			});
		});
	});
});
