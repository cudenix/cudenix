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

		it("should percent-decode values", () => {
			const result = parseCookies("a=a%20b%3Dc");

			expect(result.a).toBe("a b=c");
		});

		it.each([
			["a=%é", "�é"],
			["a=%1é", "�é"],
			["a=%[é", "�é"],
			["a=%✓", "�✓"],
			["a=%Ā", "�Ā"],
		] as const)(
			"should keep the character after the malformed escape in %j",
			(header, expected) => {
				// the escape stops before a non-ASCII character
				expect(parseCookies(header).a).toBe(expected);
			},
		);

		it("should keep the pair boundary after a malformed escape", () => {
			const result = parseCookies("a=%😀; b=v1");

			expect(result.a).toBe("�😀");
			expect(result.b).toBe("v1");
		});

		it("should replace a malformed escape instead of throwing", () => {
			expect(parseCookies("a=%ZZ").a).toBe("�");
			expect(parseCookies("a=%E0%A4%A").a).toBe("��A");
		});

		it("should leave a value without any '%' untouched", () => {
			const result = parseCookies("a=v1+v2; b=v3");

			expect(result.a).toBe("v1+v2");
			expect(result.b).toBe("v3");
		});

		it("should preserve double-quoted values verbatim (no RFC 6265 quote stripping)", () => {
			const result = parseCookies('a="v1"; b=2');

			expect(result.a).toBe('"v1"');
			expect(result.b).toBe("2");
		});

		it("should trim optional whitespace around values", () => {
			const result = parseCookies("a=v1 ; b= 2\t");

			expect(result.a).toBe("v1");
			expect(result.b).toBe("2");
		});

		it("should leave names percent-encoded", () => {
			// RFC 6265 names are tokens; Bun.CookieMap decodes values only
			const result = parseCookies("a%20b=1");

			expect(result["a%20b"]).toBe("1");
			expect("a b" in result).toBe(false);
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
		it("should split on a bare ';' with no following space", () => {
			const result = parseCookies("a=1;b=2");

			expect(result).toEqual({ a: "1", b: "2" });
		});

		it("should split on a ';' followed by a tab", () => {
			const result = parseCookies("a=1;\tb=2");

			expect(result).toEqual({ a: "1", b: "2" });
		});

		it("should split three or more pairs regardless of the spacing used", () => {
			expect(parseCookies("a=1;b=2;c=3")).toEqual({
				a: "1",
				b: "2",
				c: "3",
			});

			expect(parseCookies("a=1; b=2;  c=3")).toEqual({
				a: "1",
				b: "2",
				c: "3",
			});
		});

		it("should skip a chunk that carries no '=' of its own", () => {
			const result = parseCookies("a=1; b=2;3; c=4");

			expect(result).toEqual({ a: "1", b: "2", c: "4" });
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

		it("should drop a trailing bare ';' instead of keeping it in the value", () => {
			const result = parseCookies("a=v1;");

			expect(result).toEqual({ a: "v1" });
		});

		it("should skip a nameless chunk and still read the pair after it", () => {
			const result = parseCookies("a;b=v1");

			expect(result).toEqual({ b: "v1" });
			expect("a" in result).toBe(false);
			expect("a;b" in result).toBe(false);
		});

		it("should not leak the extra space into the name when the separator is doubled", () => {
			const result = parseCookies("a=1;  b=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect(" b" in result).toBe(false);
		});

		it("should trim optional whitespace from a leading name", () => {
			const result = parseCookies(" a=1; b=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect(" a" in result).toBe(false);
		});

		it("should trim optional whitespace between a name and its '='", () => {
			const result = parseCookies("a =1; b\t=2");

			expect(result).toEqual({ a: "1", b: "2" });
			expect("a " in result).toBe(false);
			expect("b\t" in result).toBe(false);
		});
	});

	describe("duplicate names", () => {
		// first one wins
		it("should keep the first value when a name appears multiple times", () => {
			const result = parseCookies("a=1; a=2; a=3");

			expect(result.a).toBe("1");
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should keep the first value even when it is empty", () => {
			expect(parseCookies("a=; a=1").a).toBe("");
			expect(parseCookies("a=1; a=").a).toBe("1");
		});

		it("should treat an encoded name as distinct from its decoded form", () => {
			expect(parseCookies("a%20b=v1; a b=v2")).toEqual({
				"a b": "v2",
				"a%20b": "v1",
			});
			expect(parseCookies("a b=v1; a%20b=v2")).toEqual({
				"a b": "v1",
				"a%20b": "v2",
			});
		});

		it("should not let a chunk without '=' reserve the name", () => {
			expect(parseCookies("a; a=v2")).toEqual({ a: "v2" });
			expect(parseCookies("=v1; a=v2; a=v3")).toEqual({ a: "v2" });
		});

		it("should treat names differing only in case as distinct cookies", () => {
			expect(parseCookies("A=v1; a=v2")).toEqual({ A: "v1", a: "v2" });
		});

		it("should keep first-seen insertion order when a duplicate appears later", () => {
			const result = parseCookies("a=v1; b=v2; a=v3");

			expect(Object.keys(result)).toEqual(["a", "b"]);
			expect(result.a).toBe("v1");
		});

		it("should trim optional whitespace before deduplicating", () => {
			expect(parseCookies("a =v1; a=v2")).toEqual({ a: "v1" });
		});
	});

	describe("entries skipped or dropped", () => {
		it("should skip a leading entry without '=' (flag-style)", () => {
			const result = parseCookies("b; a=v1");

			expect(result.a).toBe("v1");
			expect("b" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should skip a trailing entry without '='", () => {
			const result = parseCookies("a=v1; b");

			expect(result.a).toBe("v1");
			expect("b" in result).toBe(false);
			expect(Object.keys(result)).toEqual(["a"]);
		});

		it("should drop an empty-name entry when it is the only segment ('=v1')", () => {
			const result = parseCookies("=v1");

			expect(Object.keys(result)).toHaveLength(0);
			expect(result[""]).toBeUndefined();
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

		it("should drop a no-'=' entry ending in a bare ';' at the end of the header", () => {
			const result = parseCookies("ab;");

			expect(Object.keys(result)).toHaveLength(0);
			expect("ab" in result).toBe(false);
			expect("ab;" in result).toBe(false);
		});

		it("should drop a single-character no-'=' entry ending in a bare ';'", () => {
			const result = parseCookies("a;");

			expect(Object.keys(result)).toHaveLength(0);
			expect("a" in result).toBe(false);
			expect("a;" in result).toBe(false);
		});
	});

	describe("empty / no-pair headers", () => {
		it("should return an empty dictionary for an empty header", () => {
			const result = parseCookies("");

			expect(Object.keys(result)).toHaveLength(0);
			expect(Reflect.ownKeys(result)).toHaveLength(0);
		});

		it("should return an Empty-shaped dictionary when the header has no pairs", () => {
			const result = parseCookies("a");

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

		it("should return an empty dictionary for a bare ';' header", () => {
			const result = parseCookies(";");

			expect(Object.keys(result)).toHaveLength(0);
			expect(";" in result).toBe(false);
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
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(result)),
			).toBeNull();
		});

		it("should keep `__proto__` as data instead of rewiring the prototype chain", () => {
			const reference = parseCookies("a=v1");
			const result = parseCookies("__proto__=v1");

			expect(Object.getPrototypeOf(result)).toBe(
				Object.getPrototypeOf(reference),
			);
			expect(Reflect.ownKeys(result)).toEqual(["__proto__"]);
			expect("toString" in result).toBe(false);
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

		it("should preserve insertion order for non-numeric names", () => {
			const result = parseCookies("c=1; a=2; b=3");

			expect(Object.keys(result)).toEqual(["c", "a", "b"]);
		});

		it("should enumerate integer-like names first and in ascending order", () => {
			const result = parseCookies("2=v1; 1=v2");

			expect(Object.keys(result)).toEqual(["1", "2"]);
			expect(result["1"]).toBe("v2");
			expect(result["2"]).toBe("v1");
		});

		it("should enumerate integer-like names before non-numeric ones", () => {
			const result = parseCookies("2=v1; 1=v2; a=v3");

			expect(Object.keys(result)).toEqual(["1", "2", "a"]);
		});
	});

	describe("parity with Bun.CookieMap", () => {
		const parityCases = [
			"a=v1; b=v2",
			"a=a%20b",
			"a=%7B%22a%22%3A1%7D",
			"a%20b=v1",
			"a%3Db=v1",
			"a=%ZZ",
			"a=%E0%A4%A",
			"a=%FF",
			"a=%C3%A9",
			"a=v1%2Bv2",
			"a=v1+v2",
			"a=",
			"a=  v1  ; b=\t2\t",
			"a; b=1",
			"=v1; b=1",
			"__proto__=v1",
			"a=100%; b=50%v1",
			"a=v1; a=v2",
			"a=v1; a=v2; a=v3",
			"a=; a=1",
			"a=1; a=",
			"a%20b=v1; a b=v2",
			"a b=v1; a%20b=v2",
			"a; a=v2",
			"=v1; a=v2; a=v3",
			"a=v1; b=v2; a=v3",
			"A=v1; a=v2",
			"a =v1; a=v2",
			"a=%20; a=v1",
		];

		for (const header of parityCases) {
			it(`should match Bun.CookieMap for ${JSON.stringify(header)}`, () => {
				expect({ ...parseCookies(header) }).toEqual(
					new Bun.CookieMap(header).toJSON(),
				);
			});
		}

		it("should match Bun.CookieMap on generated ASCII headers", () => {
			// seeded LCG over ASCII-only headers
			const alphabet = [
				"a",
				"b",
				"A",
				"1",
				"2",
				"=",
				";",
				" ",
				"\t",
				"%",
				"%2",
				"%20",
				"%ZZ",
				"%C3%A9",
				"%7B",
				"%3D",
				"%3B",
				"_",
				"+",
				"-",
				"__proto__",
				"constructor",
			];

			let seed = 987654321;

			const random = () => {
				seed = (seed * 1103515245 + 12345) & 0x7fffffff;

				return seed / 0x7fffffff;
			};

			for (let iteration = 0; iteration < 5000; iteration++) {
				let header = "";

				for (
					let part = 1 + Math.floor(random() * 11);
					part > 0;
					part--
				) {
					header += alphabet[Math.floor(random() * alphabet.length)];
				}

				expect({ ...parseCookies(header) }).toEqual(
					new Bun.CookieMap(header).toJSON(),
				);
			}
		});

		it("should round-trip everything Bun.CookieMap encodes on the write path", () => {
			const written = new Bun.CookieMap();

			written.set("a", "a b");
			written.set("b", '{"a":1}');
			written.set("c", "/a/b?c=v1#f");
			written.set("d", "café ☕");
			written.set("e", "a;b");

			const header = written
				.toSetCookieHeaders()
				.map((setCookie) => setCookie.split(";")[0])
				.join("; ");

			expect(parseCookies(header)).toEqual({
				a: "a b",
				b: '{"a":1}',
				c: "/a/b?c=v1#f",
				d: "café ☕",
				e: "a;b",
			});
		});
	});
});
