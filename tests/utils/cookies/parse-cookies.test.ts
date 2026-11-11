import { beforeAll, describe, expect, it } from "bun:test";

import { parseCookies } from "@/utils/cookies/parse-cookies";
import { decodePathParam } from "@/utils/urls/decode-path-param";

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
			expect(parseCookies("a=1; b=2; c=3; d=4; e=5")).toEqual({
				a: "1",
				b: "2",
				c: "3",
				d: "4",
				e: "5",
			});
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
			expect(parseCookies("a=a%20b%3Dc").a).toBe("a b=c");
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
			expect(parseCookies("a=1;b=2")).toEqual({ a: "1", b: "2" });
		});

		it("should split on a ';' followed by a tab", () => {
			expect(parseCookies("a=1;\tb=2")).toEqual({ a: "1", b: "2" });
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
			expect(parseCookies("a=1; b=2;3; c=4")).toEqual({
				a: "1",
				b: "2",
				c: "4",
			});
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
			expect(parseCookies("a=1; ; b=2")).toEqual({ a: "1", b: "2" });
		});

		it("should drop a trailing bare ';' instead of keeping it in the value", () => {
			expect(parseCookies("a=v1;")).toEqual({ a: "v1" });
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
				"a%20b": "v1",
				"a b": "v2",
			});
			expect(parseCookies("a b=v1; a%20b=v2")).toEqual({
				"a%20b": "v2",
				"a b": "v1",
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

		it("should return a null-prototype dictionary when the header has no pairs", () => {
			const result = parseCookies("a");

			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should return an empty dictionary for a bare '=' (empty name, no other pairs)", () => {
			expect(Object.keys(parseCookies("="))).toHaveLength(0);
		});

		it("should return an empty dictionary for a bare '; ' separator", () => {
			expect(Object.keys(parseCookies("; "))).toHaveLength(0);
		});

		it("should return an empty dictionary for a bare ';' header", () => {
			const result = parseCookies(";");

			expect(Object.keys(result)).toHaveLength(0);
			expect(";" in result).toBe(false);
		});

		it("should return an empty dictionary for a whitespace-only header", () => {
			expect(Object.keys(parseCookies("   "))).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		it("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseCookies("__proto__=v1; a=v2");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(result.a).toBe("v2");
			expect(Object.getPrototypeOf(result)).toBeNull();
		});

		it("should keep `__proto__` as data instead of rewiring the prototype chain", () => {
			const result = parseCookies("__proto__=v1");

			expect(Object.getPrototypeOf(result)).toBe(
				Object.getPrototypeOf(parseCookies("a=v1")),
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

			it("should return a null-prototype dictionary", () => {
				expect(Object.getPrototypeOf(result)).toBeNull();
			});

			it("should inherit no Object.prototype methods", () => {
				expect("toString" in result).toBe(false);
				expect("hasOwnProperty" in result).toBe(false);
			});
		});

		it("should return a fresh dictionary on each call", () => {
			expect(parseCookies("a=v1")).not.toBe(parseCookies("a=v1"));
		});

		it("should preserve insertion order for non-numeric names", () => {
			expect(Object.keys(parseCookies("c=1; a=2; b=3"))).toEqual([
				"c",
				"a",
				"b",
			]);
		});

		it("should enumerate integer-like names first and in ascending order", () => {
			const result = parseCookies("2=v1; 1=v2");

			expect(Object.keys(result)).toEqual(["1", "2"]);
			expect(result["1"]).toBe("v2");
			expect(result["2"]).toBe("v1");
		});

		it("should enumerate integer-like names before non-numeric ones", () => {
			expect(Object.keys(parseCookies("2=v1; 1=v2; a=v3"))).toEqual([
				"1",
				"2",
				"a",
			]);
		});
	});

	describe("parity with Bun.CookieMap", () => {
		it.each([
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
		])("should match Bun.CookieMap for %j", (header) => {
			expect({ ...parseCookies(header) }).toEqual(
				new Bun.CookieMap(header).toJSON(),
			);
		});

		it("should match Bun.CookieMap on generated ASCII headers", () => {
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

			let seed = 987_654_321;

			const random = (): number => {
				seed = (seed * 48_271) % 2_147_483_647;

				return seed / 2_147_483_647;
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

			expect(
				parseCookies(
					written
						.toSetCookieHeaders()
						.map((setCookie) => setCookie.split(";")[0])
						.join("; "),
				),
			).toEqual({
				a: "a b",
				b: '{"a":1}',
				c: "/a/b?c=v1#f",
				d: "café ☕",
				e: "a;b",
			});
		});

		it("should agree on plain, encoded, and whitespace-padded pairs", () => {
			for (const header of [
				"a=v1",
				"a=v1; b=v2",
				"a=v1;b=v2",
				" a = v1 ; b=v2",
				"c=a%20b",
				"c=%C3%A9",
				"c=%ZZ",
				"c=%",
				"c=a+b",
				'c="quoted"',
				"a=b=c",
				"a=;b=v2",
				"=v1; b=v2",
				"novalue; b=v2",
				"a=v1;;b=v2",
				"constructor=v1",
				"__proto__=v1; b=v2",
			]) {
				expect(parseCookies(header)).toEqual(
					new Bun.CookieMap(header).toJSON(),
				);
			}
		});

		it("should keep the first value of a repeated name like Bun.CookieMap, which also keeps every duplicate", () => {
			const header = "a=v1; a=v2; b=v3";
			const map = new Bun.CookieMap(header);

			expect(parseCookies(header)).toEqual({ a: "v1", b: "v3" });
			expect(map.get("a")).toBe("v1");
			expect(map.toJSON()).toEqual({ a: "v1", b: "v3" });
			expect(map.size).toBe(3);
			expect([...map.keys()]).toEqual(["a", "a", "b"]);
		});

		it("should keep a '__proto__' cookie as an own key like Bun.CookieMap", () => {
			const header = "__proto__=v1; b=v2";
			const result = parseCookies(header);

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.b).toBe("v2");
			expect(new Bun.CookieMap(header).get("__proto__")).toBe("v1");
		});
	});

	describe("bun duplicate cookie headers", () => {
		it("should join duplicate cookie headers with '; '", () => {
			const headers = new Headers();

			headers.append("cookie", "a=v1");
			headers.append("cookie", "b=v2");

			expect(headers.get("cookie")).toBe("a=v1; b=v2");
		});

		it("should parse a joined duplicate cookie header", () => {
			const headers = new Headers();

			headers.append("cookie", "a=v1");
			headers.append("cookie", "b=v2");

			expect(parseCookies(headers.get("cookie") ?? "")).toEqual({
				a: "v1",
				b: "v2",
			});
		});

		it("should keep the first value when a duplicate header repeats a name", () => {
			const headers = new Headers();

			headers.append("cookie", "a=v1");
			headers.append("cookie", "a=v2");

			expect(parseCookies(headers.get("cookie") ?? "")).toEqual({
				a: "v1",
			});
		});

		it("should match the cookies a server received over the wire", async () => {
			const server = Bun.serve({
				development: false,
				fetch: (request) =>
					Response.json({
						cookies: parseCookies(
							request.headers.get("cookie") ?? "",
						),
						raw: request.headers.get("cookie"),
					}),
				port: 0,
			});

			const response = await fetch(`http://localhost:${server.port}/a`, {
				headers: [
					["cookie", "a=v1"],
					["cookie", "b=a%20b"],
				],
			});

			expect(await response.json()).toEqual({
				cookies: { a: "v1", b: "a b" },
				raw: "a=v1; b=a%20b",
			});

			server.stop(true);
		});
	});

	describe("whitespace edge cases", () => {
		it("should reduce a whitespace-only value to an empty string", () => {
			expect(parseCookies("a= ; b=\t\t; c=   ")).toEqual({
				a: "",
				b: "",
				c: "",
			});
		});

		it("should drop a whitespace-only name", () => {
			expect(parseCookies(" =v1; \t=v2; \t =v3")).toEqual({});
		});

		it("should trim only spaces and tabs", () => {
			expect(parseCookies("a=\u00A0v1\u00A0; b=v2\r; \nc=v3\n")).toEqual({
				a: "\u00A0v1\u00A0",
				b: "v2\r",
				"\nc": "v3\n",
			});
		});
	});

	describe("per-value decoding", () => {
		it("should decode only the values that carry an escape", () => {
			expect(parseCookies("a=v1; b=a%20b; c=v3")).toEqual({
				a: "v1",
				b: "a b",
				c: "v3",
			});
		});
	});

	describe("large headers", () => {
		it("should parse a header with many pairs", () => {
			const pairs: string[] = [];
			const expected: Record<string, string> = {};

			for (let i = 0; i < 200; i++) {
				pairs.push(`name${i}=value${i}`);
				expected[`name${i}`] = `value${i}`;
			}

			expect(parseCookies(pairs.join("; "))).toEqual(expected);
		});
	});

	describe("repeated names across calls", () => {
		it("should return the same name for a header parsed again", () => {
			for (let round = 0; round < 3; round++) {
				expect(parseCookies(`session=v${round}; theme=dark`)).toEqual({
					session: `v${round}`,
					theme: "dark",
				});
			}
		});

		it("should find a known name at another position and with padding", () => {
			expect(parseCookies("session=v1")).toEqual({ session: "v1" });
			expect(parseCookies("a=1; session=v2")).toEqual({
				a: "1",
				session: "v2",
			});
			expect(parseCookies(" \tsession \t= v3 ;b=2")).toEqual({
				b: "2",
				session: "v3",
			});
		});

		it("should keep a name apart from its prefixes and extensions", () => {
			for (let round = 0; round < 2; round++) {
				for (const name of [
					"session",
					"sessio",
					"sessions",
					"s",
					"se",
				]) {
					expect(parseCookies(`${name}=v1`)).toEqual({
						[name]: "v1",
					});
				}
			}
		});

		it("should keep thousands of same-length names apart", () => {
			const names = Array.from(
				{ length: 4096 },
				(_, i) => `n${i.toString(16).padStart(4, "0")}`,
			);

			for (let round = 0; round < 2; round++) {
				for (const [i, name] of names.entries()) {
					expect(parseCookies(`${name}=v${i}`)).toEqual({
						[name]: `v${i}`,
					});
				}
			}

			for (let i = names.length - 1; i >= 0; i--) {
				const name = names[i]!;

				expect(parseCookies(`a=1; ${name}=v${i}`)).toEqual({
					a: "1",
					[name]: `v${i}`,
				});
			}
		});

		it("should keep same-length names apart inside one header", () => {
			const names = Array.from(
				{ length: 4096 },
				(_, i) => `m${i.toString(16).padStart(4, "0")}`,
			);
			const header = names.map((name) => `${name}=1`).join("; ");

			for (let round = 0; round < 2; round++) {
				expect(Object.keys(parseCookies(header))).toEqual(names);
			}
		});

		it.each([63, 64, 65, 200])(
			"should parse a %i-character name the same way every time",
			(length) => {
				const name = "n".repeat(length);
				const other = `${"n".repeat(length - 1)}m`;

				for (let round = 0; round < 3; round++) {
					expect(parseCookies(`${name}=v${round}`)).toEqual({
						[name]: `v${round}`,
					});
					expect(parseCookies(`${other}=v${round}`)).toEqual({
						[other]: `v${round}`,
					});
				}
			},
		);
	});

	describe("parity with a split-based reference", () => {
		const trim = (value: string): string =>
			value.replaceAll(/^[\t ]+|[\t ]+$/gu, "");

		const reference = (header: string): Record<string, string> => {
			const cookies = Object.create(null) as Record<string, string>;
			const isEncoded = header.includes("%");

			for (const chunk of header.split(";")) {
				const equalsIndex = chunk.indexOf("=");

				if (equalsIndex === -1) {
					continue;
				}

				const name = trim(chunk.slice(0, equalsIndex));

				if (name === "" || name in cookies) {
					continue;
				}

				const value = trim(chunk.slice(equalsIndex + 1));

				cookies[name] = isEncoded ? decodePathParam(value) : value;
			}

			return cookies;
		};

		it("should match the reference on generated headers", () => {
			const alphabet = [
				"a",
				"b",
				"A",
				"1",
				"2",
				"=",
				"=",
				";",
				";",
				"; ",
				" ",
				"\t",
				"\n",
				"\u00A0",
				"%",
				"%2",
				"%20",
				"%ZZ",
				"%C3%A9",
				"%E2%9C%93",
				"%F0%9F%98%80",
				"%3D",
				"%3B",
				"é",
				"✓",
				"😀",
				"_",
				"+",
				'"',
				"session",
				"__proto__",
				"constructor",
				"toString",
			];

			let seed = 123_456_789;

			const random = (): number => {
				seed = (seed * 48_271) % 2_147_483_647;

				return seed / 2_147_483_647;
			};

			for (let iteration = 0; iteration < 20_000; iteration++) {
				let header = "";

				for (
					let part = 1 + Math.floor(random() * 24);
					part > 0;
					part--
				) {
					header += alphabet[Math.floor(random() * alphabet.length)];
				}

				const result = parseCookies(header);
				const expected = reference(header);

				expect(result).toEqual(expected);
				expect(Object.keys(result)).toEqual(Object.keys(expected));
				expect(Object.getPrototypeOf(result)).toBeNull();
			}
		});
	});
});
