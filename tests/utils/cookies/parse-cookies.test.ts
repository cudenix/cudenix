import { describe, expect, test } from "bun:test";

import { parseCookies } from "@/utils/cookies/parse-cookies";
import { Empty } from "@/utils/objects/empty";

describe("parseCookies", () => {
	describe("typical headers", () => {
		test("parses a standard '; '-separated header", () => {
			const result = parseCookies("sid=abc123; theme=dark");

			expect(result.sid).toBe("abc123");
			expect(result.theme).toBe("dark");
			expect(Object.keys(result)).toEqual(["sid", "theme"]);
		});

		test("parses a single pair without separators", () => {
			const result = parseCookies("sid=abc123");

			expect(result.sid).toBe("abc123");
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("supports many cookies in a single header", () => {
			const result = parseCookies("a=1; b=2; c=3; d=4; e=5");

			expect(result).toEqual({
				a: "1",
				b: "2",
				c: "3",
				d: "4",
				e: "5",
			});
		});
	});

	describe("empty / no-pair headers", () => {
		test("returns an empty dictionary for an empty header", () => {
			const result = parseCookies("");

			expect(Object.keys(result)).toHaveLength(0);
			expect(Reflect.ownKeys(result)).toHaveLength(0);
		});

		test("returns an Empty-shaped dictionary even when the header has no pairs", () => {
			const result = parseCookies("flag");

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		test("returns an empty dictionary for a bare '=' (empty name, no other pairs)", () => {
			const result = parseCookies("=");

			expect(Object.keys(result)).toHaveLength(0);
		});

		test("returns an empty dictionary for a bare '; ' separator", () => {
			const result = parseCookies("; ");

			expect(Object.keys(result)).toHaveLength(0);
		});
	});

	describe("entries skipped or dropped", () => {
		test("skips entries without '=' (e.g. flag-style entries)", () => {
			const result = parseCookies("flag; sid=abc");

			expect(result.sid).toBe("abc");
			expect("flag" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("skips a trailing entry without '='", () => {
			const result = parseCookies("sid=abc; flag");

			expect(result.sid).toBe("abc");
			expect("flag" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("drops entries with an empty name ('=value')", () => {
			const result = parseCookies("=abc; sid=value");

			expect(result.sid).toBe("value");
			expect(result[""]).toBeUndefined();
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("drops a single '=' entry with no name or value", () => {
			const result = parseCookies("=; sid=value");

			expect(result.sid).toBe("value");
			expect(result[""]).toBeUndefined();
			expect(Object.keys(result)).toEqual(["sid"]);
		});
	});

	describe("separator handling", () => {
		test("treats only '; ' (semicolon + space) as a separator", () => {
			const result = parseCookies("a=1;b=2");

			expect(result.a).toBe("1;b=2");
			expect("b" in result).toBe(false);
		});

		test("does not split on a bare ';' inside an entry", () => {
			const result = parseCookies("a=1; b=2;3; c=4");

			expect(result.a).toBe("1");
			expect(result.b).toBe("2;3");
			expect(result.c).toBe("4");
		});

		test("handles a leading '; ' delimiter (empty first chunk)", () => {
			const result = parseCookies("; sid=abc");

			expect(result.sid).toBe("abc");
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("handles a trailing '; ' delimiter (empty last chunk)", () => {
			const result = parseCookies("sid=abc; ");

			expect(result.sid).toBe("abc");
			expect(Object.keys(result)).toEqual(["sid"]);
		});

		test("consecutive '; ' separators do not introduce phantom keys", () => {
			const result = parseCookies("a=1; ; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
		});
	});

	describe("value handling", () => {
		test("keeps additional '=' characters as part of the value", () => {
			const result = parseCookies("token=a=b=c; other=1");

			expect(result.token).toBe("a=b=c");
			expect(result.other).toBe("1");
		});

		test("preserves an empty value ('name=')", () => {
			const result = parseCookies("sid=; theme=dark");

			expect(result.sid).toBe("");
			expect(result.theme).toBe("dark");
		});

		test("preserves an empty value at the end of the header", () => {
			const result = parseCookies("theme=dark; sid=");

			expect(result.theme).toBe("dark");
			expect(result.sid).toBe("");
		});

		test("does not URL-decode values (raw, undecoded)", () => {
			const result = parseCookies("k=a%20b%3Dc");

			expect(result.k).toBe("a%20b%3Dc");
		});

		test("preserves whitespace inside values", () => {
			const result = parseCookies("hello=world bar; foo=baz");

			expect(result.hello).toBe("world bar");
			expect(result.foo).toBe("baz");
		});

		test("preserves non-ASCII characters in names and values", () => {
			const result = parseCookies("café=☕; foo=bar");

			expect(result.café).toBe("☕");
			expect(result.foo).toBe("bar");
		});
	});

	describe("duplicate names", () => {
		test("keeps the last value when a name appears multiple times", () => {
			const result = parseCookies("a=1; a=2; a=3");

			expect(result.a).toBe("3");
			expect(Object.keys(result)).toEqual(["a"]);
		});

		test("keeps the last value when an empty value follows a non-empty one", () => {
			const result = parseCookies("a=1; a=");

			expect(result.a).toBe("");
		});
	});

	describe("unexpected input types", () => {
		test("throws for a null header", () => {
			expect(() => parseCookies(null as unknown as string)).toThrow(
				TypeError,
			);
		});

		test("throws for an undefined header", () => {
			expect(() => parseCookies(undefined as unknown as string)).toThrow(
				TypeError,
			);
		});

		test("treats a non-string value without length as an empty dictionary", () => {
			const result = parseCookies(123 as unknown as string);

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		test("throws for array-like values that cannot be scanned as strings", () => {
			expect(() =>
				parseCookies(["sid=abc"] as unknown as string),
			).toThrow(TypeError);
		});
	});

	describe("return shape", () => {
		test("returns a dictionary inheriting from Empty (no Object.prototype methods)", () => {
			const result = parseCookies("sid=abc");

			expect(result).toBeInstanceOf(Empty);
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(result)),
			).toBeNull();
			expect("toString" in result).toBe(false);
			expect("hasOwnProperty" in result).toBe(false);
		});

		test("each call returns a fresh dictionary", () => {
			const a = parseCookies("sid=abc");
			const b = parseCookies("sid=abc");

			expect(a).not.toBe(b);
		});
	});
});
