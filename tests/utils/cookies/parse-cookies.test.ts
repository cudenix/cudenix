import { describe, expect, it } from "bun:test";

import { parseCookies } from "@/utils/cookies/parse-cookies";

const bunCookies = (header: string): Record<string, string> =>
	new Bun.CookieMap(header).toJSON();

describe("parseCookies", () => {
	describe("parity with Bun.CookieMap", () => {
		it.each([
			["return no cookies for an empty header", "", {}],
			["split pairs on '; '", "a=v1; b=v2", { a: "v1", b: "v2" }],
			[
				"split pairs on a bare ';' and ignore a trailing one",
				"ab=1;cd=2;",
				{ ab: "1", cd: "2" },
			],
			["skip an empty chunk", "a=1;; b=2", { a: "1", b: "2" }],
			["skip a chunk without '='", "a; b=1", { b: "1" }],
			["drop an empty name", "=v1; b=1", { b: "1" }],
			["drop a whitespace-only name", " \t=v1; b=1", { b: "1" }],
			["keep an empty value", "a=; b=1", { a: "", b: "1" }],
			[
				"reduce a whitespace-only value to an empty string",
				"a= ; b=\t",
				{ a: "", b: "" },
			],
			[
				"keep additional '=' characters in the value",
				"a=v1=v2",
				{ a: "v1=v2" },
			],
			[
				"keep quotes and inner whitespace in the value",
				'a="v1 v2"',
				{ a: '"v1 v2"' },
			],
			[
				"trim spaces and tabs around names and values",
				" \tab \t= \tv1 \t; b=v2",
				{ ab: "v1", b: "v2" },
			],
			["keep the first value of a repeated name", "a=1; a=2", { a: "1" }],
			[
				"keep the first value of a repeated name even when it is empty",
				"a=; a=1",
				{ a: "" },
			],
			["percent-decode a value", "a=a%20b%3Dc", { a: "a b=c" }],
			["leave a name percent-encoded", "a%20b=c%20d", { "a%20b": "c d" }],
			[
				"decode only the values that carry an escape",
				"a%20b=v1; c=d%20e; f=g+h; i=%7B",
				{ "a%20b": "v1", c: "d e", f: "g+h", i: "{" },
			],
			[
				"decode a value after an escape in a skipped chunk",
				"%; a=b%20c",
				{ a: "b c" },
			],
			[
				"replace a malformed escape and the two characters after it",
				"promo=50%_off",
				{ promo: "50�ff" },
			],
			["replace a trailing '%'", "pct=100%", { pct: "100�" }],
		] as const)("should %s", (_, header, expected) => {
			expect(parseCookies(header)).toEqual(expected);
			expect(bunCookies(header)).toEqual(expected);
		});

		it("should match Bun.CookieMap on generated ASCII headers, except inherited names", () => {
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

				expect(parseCookies(header)).toEqual(
					Object.fromEntries(
						Object.entries(bunCookies(header)).filter(
							([name]) => !(name in Object.prototype),
						),
					),
				);
			}
		});
	});

	describe("divergences from Bun.CookieMap", () => {
		it("should keep a non-ASCII character after a malformed escape", () => {
			expect(parseCookies("a=%é")).toEqual({ a: "�é" });
			expect(bunCookies("a=%é")).toEqual({ a: "�" });
		});

		it("should trim only spaces and tabs", () => {
			expect(parseCookies("a= v1 ; \nb=v2\r")).toEqual({
				a: " v1 ",
				"\nb": "v2\r",
			});
		});

		it.each(["__proto__", "constructor", "toString"])(
			"should drop a `%s` cookie because the inherited member wins",
			(name) => {
				const header = `${name}=v1; b=v2`;
				const result = parseCookies(header);

				expect(Object.keys(result)).toEqual(["b"]);
				expect(Object.hasOwn(result, name)).toBe(false);
				expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
				expect(new Bun.CookieMap(header).get(name)).toBe("v1");
			},
		);
	});

	describe("name cache", () => {
		it("should find a cached name at another position", () => {
			expect(parseCookies("session=v1")).toEqual({ session: "v1" });
			expect(parseCookies("a=1; \tsession = v2")).toEqual({
				a: "1",
				session: "v2",
			});
		});

		it.each([
			["have the same hash", "Aa", "BB"],
			["extend one another", "fo", "for"],
		] as const)(
			"should keep names sharing a slot apart when they %s",
			(_, first, second) => {
				expect(
					parseCookies(`${first}=1; ${second}=2; ${first}=3`),
				).toEqual({ [first]: "1", [second]: "2" });
				expect(parseCookies(`${second}=1; ${first}=2`)).toEqual({
					[first]: "2",
					[second]: "1",
				});
			},
		);

		it("should parse a name too long to be cached on every call", () => {
			const name = "n".repeat(65);

			for (let round = 0; round < 2; round++) {
				expect(parseCookies(`${name}=v${round}`)).toEqual({
					[name]: `v${round}`,
				});
			}
		});
	});
});
