import { beforeAll, describe, expect, it } from "bun:test";

import { parseCookies } from "@/utils/cookies/parse-cookies";
import { Empty } from "@/utils/objects/empty";

describe("parseCookies", () => {
	describe("typical headers", () => {
		describe("with single pair 'a=v1'", () => {
			let result: ReturnType<typeof parseCookies>;

			beforeAll(() => {
				result = parseCookies("a=v1");
			});

			it("should capture the cookie value", () => {
				expect(result.a).toBe("v1");
			});

			it("should expose only the parsed cookie key", () => {
				expect(Object.keys(result)).toEqual(["a"]);
			});
		});

		describe("with two pairs 'a=v1; b=v2'", () => {
			let result: ReturnType<typeof parseCookies>;

			beforeAll(() => {
				result = parseCookies("a=v1; b=v2");
			});

			it("should capture the first cookie value", () => {
				expect(result.a).toBe("v1");
			});

			it("should capture the second cookie value", () => {
				expect(result.b).toBe("v2");
			});

			it("should preserve insertion order of the cookie names", () => {
				expect(Object.keys(result)).toEqual(["a", "b"]);
			});
		});

		it("should support many cookies in a single header", () => {
			const result = parseCookies("a=1; b=2; c=3; d=4; e=5");

			expect(result).toEqual({ a: "1", b: "2", c: "3", d: "4", e: "5" });
		});
	});

	describe("value handling", () => {
		it("should keep additional '=' characters as part of the value", () => {
			const result = parseCookies("a=v1=v2=v3; b=1");

			expect(result.a).toBe("v1=v2=v3");
			expect(result.b).toBe("1");
		});

		it("should preserve an empty value written as 'name='", () => {
			const result = parseCookies("a=; b=v1");

			expect(result.a).toBe("");
			expect(result.b).toBe("v1");
		});

		it("should preserve an empty value at the end of the header", () => {
			const result = parseCookies("a=v1; b=");

			expect(result.a).toBe("v1");
			expect(result.b).toBe("");
		});

		it("should not URL-decode values (raw, undecoded)", () => {
			const result = parseCookies("a=a%20b%3Dc");

			expect(result.a).toBe("a%20b%3Dc");
		});

		it("should decode to the original value via decodeURIComponent at the call site", () => {
			const result = parseCookies("a=a%20b");

			expect(decodeURIComponent(result.a!)).toBe("a b");
		});

		it("should preserve whitespace inside values", () => {
			const result = parseCookies("a=v1 v2; b=v3");

			expect(result.a).toBe("v1 v2");
			expect(result.b).toBe("v3");
		});

		it("should preserve non-ASCII characters in names and values", () => {
			const result = parseCookies("café=☕; a=v1");

			expect(result.café).toBe("☕");
			expect(result.a).toBe("v1");
		});

		it("should preserve surrogate-pair characters (codepoints outside the BMP)", () => {
			const result = parseCookies("a=𝕊; b=😀");

			expect(result.a).toBe("𝕊");
			expect(result.b).toBe("😀");
		});
	});

	describe("separator handling", () => {
		it("should treat only '; ' (semicolon + space) as a separator", () => {
			const result = parseCookies("a=1;b=2");

			expect(result.a).toBe("1;b=2");
			expect("b" in result).toBe(false);
		});

		it("should not split on a bare ';' inside an entry", () => {
			const result = parseCookies("a=1; b=2;3; c=4");

			expect(result.a).toBe("1");
			expect(result.b).toBe("2;3");
			expect(result.c).toBe("4");
		});

		it("should handle a leading '; ' delimiter (empty first chunk)", () => {
			const result = parseCookies("; a=v1");

			expect(result.a).toBe("v1");
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should handle a trailing '; ' delimiter (empty last chunk)", () => {
			const result = parseCookies("a=v1; ");

			expect(result.a).toBe("v1");
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should not introduce phantom keys with consecutive '; ' separators", () => {
			const result = parseCookies("a=1; ; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
		});
	});

	describe("duplicate names", () => {
		it("should keep the last value when a name appears multiple times", () => {
			const result = parseCookies("a=1; a=2; a=3");

			expect(result.a).toBe("3");
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should keep the last value when an empty value follows a non-empty one", () => {
			const result = parseCookies("a=1; a=");

			expect(result.a).toBe("");
		});
	});

	describe("entries skipped or dropped", () => {
		it("should skip a leading entry without '=' (flag-style)", () => {
			const result = parseCookies("flag; a=v1");

			expect(result.a).toBe("v1");
			expect("flag" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should skip a trailing entry without '='", () => {
			const result = parseCookies("a=v1; flag");

			expect(result.a).toBe("v1");
			expect("flag" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should drop entries with an empty name ('=value')", () => {
			const result = parseCookies("=v1; a=v2");

			expect(result.a).toBe("v2");
			expect(result[""]).toBeUndefined();
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should drop a single '=' entry with no name or value", () => {
			const result = parseCookies("=; a=v1");

			expect(result.a).toBe("v1");
			expect(result[""]).toBeUndefined();
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should drop an empty-name entry in a non-leading position", () => {
			const result = parseCookies("a=1; =v1; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect(result[""]).toBeUndefined();
		});

		it("should drop a bare '=' entry surrounded by valid pairs", () => {
			const result = parseCookies("a=1; =; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect(result[""]).toBeUndefined();
		});
	});

	describe("empty / no-pair headers", () => {
		it("should return an empty dictionary for an empty header", () => {
			const result = parseCookies("");

			expect(Object.keys(result)).toHaveLength(0);
			expect(Reflect.ownKeys(result)).toHaveLength(0);
		});

		it("should return an Empty-shaped dictionary when the header has no pairs", () => {
			const result = parseCookies("flag");

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should return an empty dictionary for a bare '=' (empty name, no other pairs)", () => {
			const result = parseCookies("=");

			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should return an empty dictionary for a bare '; ' separator", () => {
			const result = parseCookies("; ");

			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should return an empty dictionary for a whitespace-only header", () => {
			const result = parseCookies("   ");

			expect(Object.keys(result)).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		it("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseCookies("__proto__=v1; a=v2");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(result.a).toBe("v2");
			expect(({} as Record<string, unknown>).__proto__).not.toBe("v1");
		});

		it("should store `constructor` as a real own key without invoking inheritance", () => {
			const result = parseCookies("constructor=v1; a=v2");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
			expect(result.a).toBe("v2");
		});
	});

	describe("return shape", () => {
		describe("with header 'a=v1'", () => {
			let result: ReturnType<typeof parseCookies>;

			beforeAll(() => {
				result = parseCookies("a=v1");
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
			const a = parseCookies("a=v1");
			const b = parseCookies("a=v1");

			expect(a).not.toBe(b);
		});

		it("should preserve insertion order regardless of name ordering", () => {
			const result = parseCookies("z=1; a=2; m=3");

			expect(Object.keys(result)).toEqual(["z", "a", "m"]);
		});
	});
});
