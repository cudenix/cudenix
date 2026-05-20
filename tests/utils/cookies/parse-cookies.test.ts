import { beforeAll, describe, expect, test } from "bun:test";

import { parseCookies } from "@/utils/cookies/parse-cookies";
import { Empty } from "@/utils/objects/empty";

describe("parseCookies", () => {
	describe("typical headers", () => {
		describe("with single pair 'sid=abc123'", () => {
			let result: ReturnType<typeof parseCookies>;

			beforeAll(() => {
				result = parseCookies("sid=abc123");
			});

			test("should capture the cookie value", () => {
				expect(result.sid).toBe("abc123");
			});

			test("should expose only the parsed cookie key", () => {
				expect(Object.keys(result)).toEqual(["sid"]);
			});
		});

		describe("with two pairs 'sid=abc123; theme=dark'", () => {
			let result: ReturnType<typeof parseCookies>;

			beforeAll(() => {
				result = parseCookies("sid=abc123; theme=dark");
			});

			test("should capture the first cookie value", () => {
				expect(result.sid).toBe("abc123");
			});

			test("should capture the second cookie value", () => {
				expect(result.theme).toBe("dark");
			});

			test("should preserve insertion order of the cookie names", () => {
				expect(Object.keys(result)).toEqual(["sid", "theme"]);
			});
		});

		test("should support many cookies in a single header", () => {
			const result = parseCookies("a=1; b=2; c=3; d=4; e=5");

			expect(result).toEqual({ a: "1", b: "2", c: "3", d: "4", e: "5" });
		});
	});

	describe("value handling", () => {
		test("should keep additional '=' characters as part of the value", () => {
			const result = parseCookies("token=a=b=c; other=1");

			expect(result.token).toBe("a=b=c");
			expect(result.other).toBe("1");
		});

		test("should preserve an empty value written as 'name='", () => {
			const result = parseCookies("sid=; theme=dark");

			expect(result.sid).toBe("");
			expect(result.theme).toBe("dark");
		});

		test("should preserve an empty value at the end of the header", () => {
			const result = parseCookies("theme=dark; sid=");

			expect(result.theme).toBe("dark");
			expect(result.sid).toBe("");
		});

		test("should not URL-decode values (raw, undecoded)", () => {
			const result = parseCookies("k=a%20b%3Dc");

			expect(result.k).toBe("a%20b%3Dc");
		});

		test("should preserve whitespace inside values", () => {
			const result = parseCookies("hello=world bar; foo=baz");

			expect(result.hello).toBe("world bar");
			expect(result.foo).toBe("baz");
		});

		test("should preserve non-ASCII characters in names and values", () => {
			const result = parseCookies("café=☕; foo=bar");

			expect(result.café).toBe("☕");
			expect(result.foo).toBe("bar");
		});

		test("should preserve surrogate-pair characters (codepoints outside the BMP)", () => {
			const result = parseCookies("a=𝕊; b=😀");

			expect(result.a).toBe("𝕊");
			expect(result.b).toBe("😀");
		});
	});

	describe("separator handling", () => {
		test("should treat only '; ' (semicolon + space) as a separator", () => {
			const result = parseCookies("a=1;b=2");

			expect(result.a).toBe("1;b=2");
			expect("b" in result).toBe(false);
		});

		test("should not split on a bare ';' inside an entry", () => {
			const result = parseCookies("a=1; b=2;3; c=4");

			expect(result.a).toBe("1");
			expect(result.b).toBe("2;3");
			expect(result.c).toBe("4");
		});

		test("should handle a leading '; ' delimiter (empty first chunk)", () => {
			const result = parseCookies("; sid=abc");

			expect(result.sid).toBe("abc");
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("should handle a trailing '; ' delimiter (empty last chunk)", () => {
			const result = parseCookies("sid=abc; ");

			expect(result.sid).toBe("abc");
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("should not introduce phantom keys with consecutive '; ' separators", () => {
			const result = parseCookies("a=1; ; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
		});
	});

	describe("duplicate names", () => {
		test("should keep the last value when a name appears multiple times", () => {
			const result = parseCookies("a=1; a=2; a=3");

			expect(result.a).toBe("3");
			expect(Object.keys(result)).toEqual(["a"]);
		});

		test("should keep the last value when an empty value follows a non-empty one", () => {
			const result = parseCookies("a=1; a=");

			expect(result.a).toBe("");
		});
	});

	describe("entries skipped or dropped", () => {
		test("should skip a leading entry without '=' (flag-style)", () => {
			const result = parseCookies("flag; sid=abc");

			expect(result.sid).toBe("abc");
			expect("flag" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("should skip a trailing entry without '='", () => {
			const result = parseCookies("sid=abc; flag");

			expect(result.sid).toBe("abc");
			expect("flag" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("should drop entries with an empty name ('=value')", () => {
			const result = parseCookies("=abc; sid=value");

			expect(result.sid).toBe("value");
			expect(result[""]).toBeUndefined();
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("should drop a single '=' entry with no name or value", () => {
			const result = parseCookies("=; sid=value");

			expect(result.sid).toBe("value");
			expect(result[""]).toBeUndefined();
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("should drop an empty-name entry in a non-leading position", () => {
			const result = parseCookies("a=1; =bad; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect(result[""]).toBeUndefined();
		});

		test("should drop a bare '=' entry surrounded by valid pairs", () => {
			const result = parseCookies("a=1; =; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect(result[""]).toBeUndefined();
		});
	});

	describe("empty / no-pair headers", () => {
		test("should return an empty dictionary for an empty header", () => {
			const result = parseCookies("");

			expect(Object.keys(result)).toHaveLength(0);
			expect(Reflect.ownKeys(result)).toHaveLength(0);
		});

		test("should return an Empty-shaped dictionary when the header has no pairs", () => {
			const result = parseCookies("flag");

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		test("should return an empty dictionary for a bare '=' (empty name, no other pairs)", () => {
			const result = parseCookies("=");

			expect(Object.keys(result)).toHaveLength(0);
		});

		test("should return an empty dictionary for a bare '; ' separator", () => {
			const result = parseCookies("; ");

			expect(Object.keys(result)).toHaveLength(0);
		});

		test("should return an empty dictionary for a whitespace-only header", () => {
			const result = parseCookies("   ");

			expect(Object.keys(result)).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		test("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseCookies("__proto__=evil; sid=abc");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("evil");
			expect(result.sid).toBe("abc");
			expect(({} as Record<string, unknown>).__proto__).not.toBe("evil");
		});

		test("should store `constructor` as a real own key without invoking inheritance", () => {
			const result = parseCookies("constructor=hijack; sid=abc");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("hijack");
			expect(result.sid).toBe("abc");
		});
	});

	describe("return shape", () => {
		describe("with header 'sid=abc'", () => {
			let result: ReturnType<typeof parseCookies>;

			beforeAll(() => {
				result = parseCookies("sid=abc");
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
			const a = parseCookies("sid=abc");
			const b = parseCookies("sid=abc");

			expect(a).not.toBe(b);
		});

		test("should preserve insertion order regardless of name ordering", () => {
			const result = parseCookies("z=1; a=2; m=3");

			expect(Object.keys(result)).toEqual(["z", "a", "m"]);
		});
	});
});
