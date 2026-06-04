import { beforeAll, describe, expect, test } from "bun:test";

import { Empty } from "@/utils/objects/empty";
import { parseQuery } from "@/utils/urls/parse-query";

describe("parseQuery", () => {
	describe("typical query strings", () => {
		describe("with single pair '?b=v1'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1");
			});

			test("should capture the parameter value", () => {
				expect(result.b).toBe("v1");
			});

			test("should expose only the parsed parameter key", () => {
				expect(Object.keys(result)).toEqual(["b"]);
			});
		});

		describe("with two pairs '?b=v1&c=v2'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1&c=v2");
			});

			test("should capture the first parameter value", () => {
				expect(result.b).toBe("v1");
			});

			test("should capture the second parameter value", () => {
				expect(result.c).toBe("v2");
			});

			test("should preserve insertion order of the parameter names", () => {
				expect(Object.keys(result)).toEqual(["b", "c"]);
			});
		});

		test("should support many parameters in a single query string", () => {
			const result = parseQuery("/a?b=1&c=2&d=3&e=4&f=5");

			expect(result).toEqual({ b: "1", c: "2", d: "3", e: "4", f: "5" });
		});

		test("should read the query from a full absolute URL", () => {
			const result = parseQuery("https://host/a?b=v1&c=v2");

			expect(result).toEqual({ b: "v1", c: "v2" });
		});
	});

	describe("key and value decoding", () => {
		test("should turn '+' into a space inside a key", () => {
			const result = parseQuery("/a?b+c=v1");

			expect(result["b c"]).toBe("v1");
		});

		test("should turn '+' into a space inside a value", () => {
			const result = parseQuery("/a?b=v1+v2");

			expect(result.b).toBe("v1 v2");
		});

		test("should decode '%xx' escapes inside a key", () => {
			const result = parseQuery("/a?b%20c=v1");

			expect(result["b c"]).toBe("v1");
		});

		test("should decode '%xx' escapes inside a value", () => {
			const result = parseQuery("/a?b=v1%20v2");

			expect(result.b).toBe("v1 v2");
		});

		test("should apply both '+' and '%xx' decoding to the same key", () => {
			const result = parseQuery("/a?b+c%21=v1");

			expect(result["b c!"]).toBe("v1");
		});

		test("should apply both '+' and '%xx' decoding to the same value", () => {
			const result = parseQuery("/a?b=v1+v2%21");

			expect(result.b).toBe("v1 v2!");
		});

		test("should preserve non-ASCII characters in keys and values", () => {
			const result = parseQuery("/a?café=☕&b=v1");

			expect(result.café).toBe("☕");
			expect(result.b).toBe("v1");
		});

		test("should preserve surrogate-pair characters (codepoints outside the BMP)", () => {
			const result = parseQuery("/a?b=𝕊&c=😀");

			expect(result.b).toBe("𝕊");
			expect(result.c).toBe("😀");
		});

		test("should keep additional '=' characters as part of the value", () => {
			const result = parseQuery("/a?b=v1=v2");

			expect(result.b).toBe("v1=v2");
		});
	});

	describe("JSON-shaped values", () => {
		test("should parse a value wrapped in '{...}' as an object", () => {
			const result = parseQuery('/a?b={"c":1}');

			expect(result.b).toEqual({ c: 1 });
		});

		test("should parse a value wrapped in '[...]' as an array", () => {
			const result = parseQuery("/a?b=[1,2,3]");

			expect(result.b).toEqual([1, 2, 3]);
		});

		test("should parse a percent-encoded JSON object", () => {
			const result = parseQuery("/a?b=%7B%22c%22%3A1%7D");

			expect(result.b).toEqual({ c: 1 });
		});

		test("should fall back to the raw string when JSON parsing fails", () => {
			const result = parseQuery("/a?b={bad}");

			expect(result.b).toBe("{bad}");
		});

		test("should not parse a value that opens but never closes a brace", () => {
			const result = parseQuery("/a?b={c");

			expect(result.b).toBe("{c");
		});

		test("should not parse a value that opens but never closes a bracket", () => {
			const result = parseQuery("/a?b=[1");

			expect(result.b).toBe("[1");
		});

		test("should not parse a value whose brackets are mismatched", () => {
			const result = parseQuery("/a?b={1]");

			expect(result.b).toBe("{1]");
		});
	});

	describe("keys without a value", () => {
		test("should map a bare key with no '=' to an empty string", () => {
			const result = parseQuery("/a?b");

			expect(result.b).toBe("");
		});

		test("should map a key written as 'b=' to an empty string", () => {
			const result = parseQuery("/a?b=&c=v1");

			expect(result.b).toBe("");
			expect(result.c).toBe("v1");
		});

		test("should handle a bare key followed by another pair", () => {
			const result = parseQuery("/a?b&c=v1");

			expect(result).toEqual({ b: "", c: "v1" });
		});
	});

	describe("fragment handling", () => {
		test("should stop parsing at a '#' fragment after a value", () => {
			const result = parseQuery("/a?b=v1#section");

			expect(result.b).toBe("v1");
			expect("section" in result).toBe(false);
		});

		test("should stop parsing at a '#' fragment that ends a key", () => {
			const result = parseQuery("/a?b#section");

			expect(result.b).toBe("");
			expect(Object.keys(result)).toEqual(["b"]);
		});

		test("should ignore parameters that live in the fragment", () => {
			const result = parseQuery("/a?b=v1#c=v2");

			expect(result).toEqual({ b: "v1" });
		});
	});

	describe("repeated keys", () => {
		test("should collapse two occurrences into an array in first-seen order", () => {
			const result = parseQuery("/a?b=v1&b=v2");

			expect(result.b).toEqual(["v1", "v2"]);
		});

		test("should append further occurrences onto the existing array", () => {
			const result = parseQuery("/a?b=v1&b=v2&b=v3");

			expect(result.b).toEqual(["v1", "v2", "v3"]);
		});

		test("should wrap a JSON array value as a single element when the key repeats", () => {
			const result = parseQuery("/a?b=[1,2]&b=v3");

			expect(result.b).toEqual([[1, 2], "v3"]);
		});

		test("should wrap a JSON object value as a single element when the key repeats", () => {
			const result = parseQuery('/a?b={"c":1}&b=v3');

			expect(result.b).toEqual([{ c: 1 }, "v3"]);
		});

		test("should keep repeated JSON array values as distinct elements", () => {
			const result = parseQuery("/a?b=[1,2]&b=[3,4]");

			expect(result.b).toEqual([
				[1, 2],
				[3, 4],
			]);
		});
	});

	describe("entries skipped or dropped", () => {
		test("should drop a leading entry with an empty key ('=v1')", () => {
			const result = parseQuery("/a?=v1&b=v2");

			expect(result).toEqual({ b: "v2" });
			expect(result[""]).toBeUndefined();
		});

		test("should drop an empty-key entry between two valid pairs", () => {
			const result = parseQuery("/a?b=1&=v1&c=2");

			expect(result).toEqual({ b: "1", c: "2" });
			expect(result[""]).toBeUndefined();
		});

		test("should ignore a leading '&' separator", () => {
			const result = parseQuery("/a?&b=v1");

			expect(result).toEqual({ b: "v1" });
		});
	});

	describe("empty or no usable parameters", () => {
		test("should return an empty dictionary when the URL has no '?'", () => {
			const result = parseQuery("/a");

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		test("should return an empty dictionary for an empty string", () => {
			expect(Object.keys(parseQuery(""))).toHaveLength(0);
		});

		test("should return an empty dictionary for a lone '?'", () => {
			expect(Object.keys(parseQuery("/a?"))).toHaveLength(0);
		});

		test("should return an empty dictionary when only an empty-key pair is present", () => {
			expect(Object.keys(parseQuery("/a?=v1"))).toHaveLength(0);
		});

		test("should return an empty dictionary for a lone '&' separator", () => {
			expect(Object.keys(parseQuery("/a?&"))).toHaveLength(0);
		});

		test("should return an empty dictionary when the query is only a fragment", () => {
			expect(Object.keys(parseQuery("/a?#section"))).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		test("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseQuery("/a?__proto__=v1&b=v2");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(result.b).toBe("v2");
			expect(({} as Record<string, unknown>).__proto__).not.toBe("v1");
		});

		test("should store `constructor` as a real own key without invoking inheritance", () => {
			const result = parseQuery("/a?constructor=v1&b=v2");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
			expect(result.b).toBe("v2");
		});

		test("should not pollute the prototype when a JSON value carries a `__proto__` key", () => {
			const result = parseQuery('/a?b={"__proto__":{"polluted":1}}');

			expect(Object.hasOwn(result, "b")).toBe(true);
			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		});
	});

	describe("return shape", () => {
		describe("with query '?b=v1'", () => {
			let result: ReturnType<typeof parseQuery>;

			beforeAll(() => {
				result = parseQuery("/a?b=v1");
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

		test("should return a fresh dictionary on each call", () => {
			const a = parseQuery("/a?b=v1");
			const b = parseQuery("/a?b=v1");

			expect(a).not.toBe(b);
		});

		test("should preserve insertion order regardless of name ordering", () => {
			const result = parseQuery("/a?z=1&a=2&m=3");

			expect(Object.keys(result)).toEqual(["z", "a", "m"]);
		});
	});
});
