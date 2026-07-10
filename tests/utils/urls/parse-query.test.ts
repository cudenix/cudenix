import { beforeAll, describe, expect, it } from "bun:test";

import { Empty } from "@/utils/objects/empty";
import { parseQuery } from "@/utils/urls/parse-query";

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
			const result = parseQuery("/a?b=1&c=2&d=3&e=4&f=5");

			expect(result).toEqual({ b: "1", c: "2", d: "3", e: "4", f: "5" });
		});

		it("should read the query from a full absolute URL", () => {
			const result = parseQuery("https://host/a?b=v1&c=v2");

			expect(result).toEqual({ b: "v1", c: "v2" });
		});
	});

	describe("key and value decoding", () => {
		it("should turn '+' into a space inside a key", () => {
			const result = parseQuery("/a?b+c=v1");

			expect(result["b c"]).toBe("v1");
		});

		it("should turn '+' into a space inside a value", () => {
			const result = parseQuery("/a?b=v1+v2");

			expect(result.b).toBe("v1 v2");
		});

		it("should decode '%xx' escapes inside a key", () => {
			const result = parseQuery("/a?b%20c=v1");

			expect(result["b c"]).toBe("v1");
		});

		it("should keep a key that is non-empty raw but decodes to whitespace", () => {
			const result = parseQuery("/a?%20=v1");

			expect(Object.hasOwn(result, " ")).toBe(true);
			expect(result[" "]).toBe("v1");
		});

		it("should decode '%xx' escapes inside a value", () => {
			const result = parseQuery("/a?b=v1%20v2");

			expect(result.b).toBe("v1 v2");
		});

		it("should apply both '+' and '%xx' decoding to the same key", () => {
			const result = parseQuery("/a?b+c%21=v1");

			expect(result["b c!"]).toBe("v1");
		});

		it("should apply both '+' and '%xx' decoding to the same value", () => {
			const result = parseQuery("/a?b=v1+v2%21");

			expect(result.b).toBe("v1 v2!");
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
			const result = parseQuery("/a?b=v1=v2");

			expect(result.b).toBe("v1=v2");
		});

		it("should decode '%2B' to a literal '+' in a value (decode runs after '+' replacement)", () => {
			const result = parseQuery("/a?b=1%2B2");

			expect(result.b).toBe("1+2");
		});

		it("should decode '%2B' to a literal '+' in a key", () => {
			const result = parseQuery("/a?a%2Bb=v1");

			expect(result["a+b"]).toBe("v1");
		});

		it("should keep a '?' after the first one as literal data in a value", () => {
			const result = parseQuery("/a?b=v?1");

			expect(result.b).toBe("v?1");
		});

		it("should keep a '?' after the first one as literal data in a key", () => {
			const result = parseQuery("/a?b?c=v1");

			expect(result["b?c"]).toBe("v1");
		});

		it("should decode '%26' and '%3D' into the value without splitting the pair", () => {
			const result = parseQuery("/a?a=1%262%3D3");

			expect(result).toEqual({ a: "1&2=3" });
		});

		it("should decode '%23' into the value without truncating at a fragment", () => {
			const result = parseQuery("/a?a=1%232&b=2");

			expect(result).toEqual({ a: "1#2", b: "2" });
		});
	});

	describe("malformed percent-escapes", () => {
		it("should keep a bare '%' in a value verbatim instead of throwing", () => {
			const result = parseQuery("/a?b=100%&c=v2");

			expect(result.b).toBe("100%");
			expect(result.c).toBe("v2");
		});

		it("should keep a non-hex '%' escape in a value verbatim", () => {
			const result = parseQuery("/a?b=%zz");

			expect(result.b).toBe("%zz");
		});

		it("should keep a malformed '%' escape in a key verbatim", () => {
			const result = parseQuery("/a?b%=v1");

			expect(result["b%"]).toBe("v1");
		});

		it("should keep a truncated multibyte escape verbatim instead of throwing", () => {
			const result = parseQuery("/a?b=%E0%A4%A");

			expect(result.b).toBe("%E0%A4%A");
		});

		it("should keep the plus-replaced value when a '%' escape is malformed", () => {
			const result = parseQuery("/a?b=a+100%");

			expect(result.b).toBe("a 100%");
		});

		it("should keep the plus-replaced key when a '%' escape is malformed", () => {
			const result = parseQuery("/a?a+100%=v1");

			expect(result["a 100%"]).toBe("v1");
		});
	});

	describe("JSON-shaped values", () => {
		it("should parse a value wrapped in '{...}' as an object", () => {
			const result = parseQuery('/a?b={"c":1}');

			expect(result.b).toEqual({ c: 1 });
		});

		it("should parse a value wrapped in '[...]' as an array", () => {
			const result = parseQuery("/a?b=[1,2,3]");

			expect(result.b).toEqual([1, 2, 3]);
		});

		it("should parse a percent-encoded JSON object", () => {
			const result = parseQuery("/a?b=%7B%22c%22%3A1%7D");

			expect(result.b).toEqual({ c: 1 });
		});

		it("should fall back to the raw string when JSON parsing fails", () => {
			const result = parseQuery("/a?b={bad}");

			expect(result.b).toBe("{bad}");
		});

		it("should keep the raw string when a percent-decode failure leaves JSON-shaped text", () => {
			const result = parseQuery("/a?b={%zz}");

			expect(result.b).toBe("{%zz}");
		});

		it("should not parse a value that opens but never closes a brace", () => {
			const result = parseQuery("/a?b={c");

			expect(result.b).toBe("{c");
		});

		it("should not parse a value that opens but never closes a bracket", () => {
			const result = parseQuery("/a?b=[1");

			expect(result.b).toBe("[1");
		});

		it("should not parse a value whose brackets are mismatched", () => {
			const result = parseQuery("/a?b={1]");

			expect(result.b).toBe("{1]");
		});

		it("should parse an empty JSON object value", () => {
			const result = parseQuery("/a?b={}");

			expect(result.b).toEqual({});
		});

		it("should parse an empty JSON array value", () => {
			const result = parseQuery("/a?b=[]");

			expect(result.b).toEqual([]);
		});

		it("should keep a lone '{' or '[' as a string", () => {
			expect(parseQuery("/a?b={").b).toBe("{");
			expect(parseQuery("/a?b=[").b).toBe("[");
		});

		it("should turn '+' into a space inside a JSON string before parsing", () => {
			const result = parseQuery('/a?b={"c":"1+2"}');

			expect(result.b).toEqual({ c: "1 2" });
		});

		it("should preserve a literal '+' inside a JSON string when written as '%2B'", () => {
			const result = parseQuery('/a?b={"c":"1%2B2"}');

			expect(result.b).toEqual({ c: "1+2" });
		});

		it("should split a JSON value on a raw '&' (JSON values must be fully percent-encoded)", () => {
			const result = parseQuery('/a?b={"a":"x&y"}');

			expect(result.b).toBe('{"a":"x');
			expect(result['y"}']).toBe("");
			expect(Object.keys(result)).toEqual(["b", 'y"}']);
		});
	});

	describe("keys without a value", () => {
		it("should map a bare key with no '=' to an empty string", () => {
			const result = parseQuery("/a?b");

			expect(result.b).toBe("");
		});

		it("should map a key written as 'b=' to an empty string", () => {
			const result = parseQuery("/a?b=&c=v1");

			expect(result.b).toBe("");
			expect(result.c).toBe("v1");
		});

		it("should handle a bare key followed by another pair", () => {
			const result = parseQuery("/a?b&c=v1");

			expect(result).toEqual({ b: "", c: "v1" });
		});

		it("should collapse a bare repeat of an assigned key into an array with an empty string", () => {
			const result = parseQuery("/a?b=v1&b");

			expect(result.b).toEqual(["v1", ""]);
		});

		it("should collapse an assigned repeat of a bare key into an array starting with an empty string", () => {
			const result = parseQuery("/a?b&b=v1");

			expect(result.b).toEqual(["", "v1"]);
		});

		it("should ignore a trailing '&' separator", () => {
			const result = parseQuery("/a?b=v1&");

			expect(result).toEqual({ b: "v1" });
		});
	});

	describe("fragment handling", () => {
		it("should stop parsing at a '#' fragment after a value", () => {
			const result = parseQuery("/a?b=v1#section");

			expect(result.b).toBe("v1");
			expect("section" in result).toBe(false);
		});

		it("should stop parsing at a '#' fragment that ends a key", () => {
			const result = parseQuery("/a?b#section");

			expect(result.b).toBe("");
			expect(Object.keys(result)).toEqual(["b"]);
		});

		it("should ignore parameters that live in the fragment", () => {
			const result = parseQuery("/a?b=v1#c=v2");

			expect(result).toEqual({ b: "v1" });
		});

		it("should not recognize a '#' before the first '?' as a fragment", () => {
			const result = parseQuery("/a#f?b=v1");

			expect(result).toEqual({ b: "v1" });
		});
	});

	describe("repeated keys", () => {
		it("should collapse two occurrences into an array in first-seen order", () => {
			const result = parseQuery("/a?b=v1&b=v2");

			expect(result.b).toEqual(["v1", "v2"]);
		});

		it("should append further occurrences onto the existing array", () => {
			const result = parseQuery("/a?b=v1&b=v2&b=v3");

			expect(result.b).toEqual(["v1", "v2", "v3"]);
		});

		it("should wrap a JSON array value as a single element when the key repeats", () => {
			const result = parseQuery("/a?b=[1,2]&b=v3");

			expect(result.b).toEqual([[1, 2], "v3"]);
		});

		it("should wrap a JSON object value as a single element when the key repeats", () => {
			const result = parseQuery('/a?b={"c":1}&b=v3');

			expect(result.b).toEqual([{ c: 1 }, "v3"]);
		});

		it("should keep repeated JSON array values as distinct elements", () => {
			const result = parseQuery("/a?b=[1,2]&b=[3,4]");

			expect(result.b).toEqual([
				[1, 2],
				[3, 4],
			]);
		});

		it("should collapse differently-encoded spellings of the same key into one array", () => {
			const result = parseQuery("/a?a%20b=1&a+b=2");

			expect(result["a b"]).toEqual(["1", "2"]);
			expect(Object.keys(result)).toEqual(["a b"]);
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
			const result = parseQuery("/a?&b=v1");

			expect(result).toEqual({ b: "v1" });
		});
	});

	describe("empty or no usable parameters", () => {
		it("should return an empty dictionary when the URL has no '?'", () => {
			const result = parseQuery("/a");

			expect(result).toBeInstanceOf(Empty);
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
			expect(Object.keys(parseQuery("/a?#section"))).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		it("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseQuery("/a?__proto__=v1&b=v2");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(result.b).toBe("v2");
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(result)),
			).toBeNull();
		});

		it("should store `constructor` as a real own key without invoking inheritance", () => {
			const result = parseQuery("/a?constructor=v1&b=v2");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
			expect(result.b).toBe("v2");
		});

		it("should not pollute the prototype when a JSON value carries a `__proto__` key", () => {
			const result = parseQuery('/a?b={"__proto__":{"polluted":1}}');

			expect(Object.hasOwn(result, "b")).toBe(true);
			expect(Object.hasOwn(result.b as object, "__proto__")).toBe(true);
			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		});
	});

	describe("return shape", () => {
		describe("with query '?b=v1'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1");
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

		it("should return a fresh dictionary on each call", () => {
			const a = parseQuery("/a?b=v1");
			const b = parseQuery("/a?b=v1");

			expect(a).not.toBe(b);
		});

		it("should preserve insertion order regardless of name ordering", () => {
			const result = parseQuery("/a?z=1&a=2&m=3");

			expect(Object.keys(result)).toEqual(["z", "a", "m"]);
		});
	});
});
