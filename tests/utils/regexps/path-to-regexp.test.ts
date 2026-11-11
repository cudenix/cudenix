import { beforeAll, describe, expect, it } from "bun:test";

import {
	PARAM_FLAG_OPTIONAL,
	PARAM_FLAG_REST,
	pathToRegexp,
} from "@/utils/regexps/path-to-regexp";

const compile = (
	path: string,
): {
	paramFlags: number[];
	paramKeys: string[];
	pattern: string;
	regex: RegExp;
	restKeys: string[];
} => {
	const { paramFlags, paramKeys, pattern, restKeys } = pathToRegexp(path);

	return {
		paramFlags,
		paramKeys,
		pattern,
		regex: new RegExp(`^${pattern}$`, "u"),
		restKeys,
	};
};

describe("pathToRegexp", () => {
	describe("root path '/'", () => {
		it("should return the special-case shape", () => {
			const result = pathToRegexp("/");

			expect(result.paramKeys).toEqual([]);
			expect(result.pattern).toBe(String.raw`\/()`);
			expect(result.restKeys).toEqual([]);
		});

		it("should compile a regex that matches only '/'", () => {
			const { regex } = compile("/");

			expect(regex.test("/")).toBe(true);
			expect(regex.test("")).toBe(false);
			expect(regex.test("/a")).toBe(false);
		});
	});

	describe("empty path ''", () => {
		it("should produce the seed-only pattern", () => {
			const { paramKeys, pattern, restKeys } = pathToRegexp("");

			expect(paramKeys).toEqual([]);
			expect(pattern).toBe("()");
			expect(restKeys).toEqual([]);
		});

		it("should compile a regex that matches only the empty string", () => {
			const { regex } = compile("");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(false);
			expect(regex.test("/a")).toBe(false);
		});

		it("should normalize a slashes-only path to the root, not to the empty path", () => {
			for (const path of ["//", "///"]) {
				const { paramKeys, pattern, restKeys } = pathToRegexp(path);

				expect(paramKeys).toEqual([]);
				expect(pattern).toBe(pathToRegexp("/").pattern);
				expect(restKeys).toEqual([]);
			}
		});

		it("should make a slashes-only path reachable by a real request", () => {
			const { regex } = compile("//");

			expect(regex.test("/")).toBe(true);
			expect(regex.test("")).toBe(false);
		});
	});

	describe("literal segments", () => {
		it("should compile a single literal segment", () => {
			const { paramKeys, regex, restKeys } = compile("/a");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/b")).toBe(false);
			expect(regex.test("/a/b")).toBe(false);
		});

		it("should match literal segments case-sensitively", () => {
			const { regex } = compile("/a");

			expect(regex.test("/A")).toBe(false);
		});

		it("should compile multiple literal segments", () => {
			const { regex } = compile("/a/b/c");

			expect(regex.test("/a/b/c")).toBe(true);
			expect(regex.test("/a/b")).toBe(false);
			expect(regex.test("/a/b/c/d")).toBe(false);
		});

		it("should normalize a path without a leading '/' the same as one with it", () => {
			const withSlash = pathToRegexp("/a/:p1");
			const withoutSlash = pathToRegexp("a/:p1");

			expect(withoutSlash.pattern).toBe(withSlash.pattern);
			expect(withoutSlash.paramKeys).toEqual(withSlash.paramKeys);
			expect(withoutSlash.restKeys).toEqual(withSlash.restKeys);

			const { regex } = compile("a/:p1");

			expect("/a/v1".match(regex)?.[1]).toBe("v1");
		});

		it("should ignore extra consecutive slashes between segments", () => {
			const { regex } = compile("//a");

			expect(regex.test("/a")).toBe(true);
		});

		it("should ignore a trailing slash", () => {
			const { regex } = compile("/a/");

			expect(regex.test("/a")).toBe(true);
		});

		it("should escape regex-special characters in literal segments", () => {
			const { regex } = compile("/a.b");

			expect(regex.test("/a.b")).toBe(true);
			expect(regex.test("/aXb")).toBe(false);
		});

		it("should escape additional regex-special characters in literals", () => {
			// "{", "}" and "^" are percent-encoded instead
			const symbols = ["(", ")", "[", "]", "+", "|", "$"];

			for (let i = 0; i < symbols.length; i++) {
				const path = `/a${symbols[i]}b`;

				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
				expect(regex.test("/aXb")).toBe(false);
				expect(regex.test("/ab")).toBe(false);
			}
		});

		describe(String.raw`'\' separator`, () => {
			it(String.raw`should compile a '\' exactly like a '/'`, () => {
				expect(pathToRegexp(String.raw`/a\b`).pattern).toBe(
					pathToRegexp("/a/b").pattern,
				);
				expect(pathToRegexp(String.raw`/a\b`).ranks).toEqual([0, 0]);
			});

			it(
				String.raw`should match the pathname the parser builds from a '\' path`,
				() => {
					const { regex } = compile(String.raw`/a\b`);

					expect(
						regex.test(
							new URL(String.raw`http://localhost/a\b`).pathname,
						),
					).toBe(true);
					expect(regex.test("/a/b")).toBe(true);
				},
			);

			it("should collide with the '/' spelling of the same path", () => {
				const backslash = pathToRegexp(String.raw`/a\b/:p1`);
				const slash = pathToRegexp("/a/b/:p1");

				expect(backslash.pattern).toBe(slash.pattern);
				expect(backslash.paramKeys).toEqual(slash.paramKeys);
				expect(backslash.ranks).toEqual(slash.ranks);
			});

			it(String.raw`should read a parameter that follows a '\'`, () => {
				const { paramKeys } = compile(String.raw`/a\:p1`);

				expect(paramKeys).toEqual(["p1"]);
				expect(pathToRegexp(String.raw`/a\:p1`).ranks).toEqual([0, 1]);
			});

			it(
				String.raw`should treat a trailing '\' as a trailing separator`,
				() => {
					expect(pathToRegexp("/a\\").pattern).toBe(
						pathToRegexp("/a/").pattern,
					);
				},
			);

			it("should normalize a path of nothing but separators to the root", () => {
				expect(pathToRegexp(String.raw`\\`).pattern).toBe(
					String.raw`\/()`,
				);
				expect(pathToRegexp(String.raw`/\/`).pattern).toBe(
					String.raw`\/()`,
				);
			});
		});

		it("should escape balanced parentheses without adding a capture group", () => {
			const { regex } = compile("/a(b)c");

			expect(regex.exec("/a(b)c")?.length).toBe(2);
			expect(regex.test("/abc")).toBe(false);
		});

		it("should escape balanced brackets instead of building a character class", () => {
			const { regex } = compile("/a[bc]d");

			expect(regex.exec("/a[bc]d")?.length).toBe(2);
			expect(regex.test("/abd")).toBe(false);
			expect(regex.test("/acd")).toBe(false);
		});

		it("should keep constructor-safe punctuation literal", () => {
			const segments = ["1abc", "a-b", "a,b", "a;b", "a=b", "a@b", "a~b"];

			for (let i = 0; i < segments.length; i++) {
				const path = `/${segments[i]}`;
				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
				expect(regex.test(`${path}x`)).toBe(false);
			}
		});

		it("should compile whitespace and control characters to their escapes", () => {
			const segments = [
				["a b", "a%20b"],
				["a\nb", "a%0Ab"],
				["a\rb", "a%0Db"],
				["a\tb", "a%09b"],
				["a\u0000b", "a%00b"],
				["a\u007Fb", "a%7Fb"],
				["a\u2028b", "a%E2%80%A8b"],
			] as const;

			for (let i = 0; i < segments.length; i++) {
				const [path, encoded] = segments[i]!;
				const { regex } = compile(`/${path}`);

				expect(regex.test(`/${encoded}`)).toBe(true);
				expect(regex.test(`/${path}`)).toBe(false);
				expect(regex.test(`/${encoded}x`)).toBe(false);
			}
		});

		it("should compile a lone surrogate the way the url parser replaces it", () => {
			const { regex } = compile("/a\uD800b");

			expect(regex.test("/a%EF%BF%BDb")).toBe(true);
		});

		it("should not treat '+' in a literal as regex repetition", () => {
			const { regex } = compile("/a+b");

			expect(regex.test("/a+b")).toBe(true);
			expect(regex.test("/aaab")).toBe(false);
			expect(regex.test("/ab")).toBe(false);
		});

		it("should not treat '|' in a literal as alternation", () => {
			const { regex } = compile("/a|b");

			expect(regex.test("/a|b")).toBe(true);
			expect(regex.test("/a")).toBe(false);
			expect(regex.test("/b")).toBe(false);
		});

		it("should compile a '?' in the middle of a segment to its percent-encoding", () => {
			const { pattern, regex } = compile("/a?b");

			// "?" matches only percent-encoded, exact hex casing
			expect(pattern).toBe(String.raw`\/a%3Fb()`);
			expect(regex.test("/a%3Fb")).toBe(true);
			expect(regex.test("/a%3fb")).toBe(false);
			expect(regex.test("/a?b")).toBe(false);
			expect(regex.test("/ab")).toBe(false);
		});

		it("should compile a '#' in the middle of a segment to its percent-encoding", () => {
			const { pattern, regex } = compile("/a#b");

			expect(pattern).toBe(String.raw`\/a%23b()`);
			expect(regex.test("/a%23b")).toBe(true);
			expect(regex.test("/a#b")).toBe(false);
		});

		it("should not let a '?' segment shadow the route the request actually asked for", () => {
			const shadowing = pathToRegexp("/a?b=1").pattern;
			const real = pathToRegexp("/a").pattern;
			const combined = new RegExp(
				`^(?:https?:\\/\\/)[^\\s\\/]+(?:${shadowing}|${real})(?![^?#])`,
				"u",
			);

			// group 1 is the shadowing marker, group 2 the real one
			expect(combined.exec("http://localhost/a?b=1")?.[2]).toBe("");
			expect(
				combined.exec("http://localhost/a?b=1")?.[1],
			).toBeUndefined();
		});

		it("should treat a ':' in the middle of a segment as a literal character", () => {
			const { paramKeys, regex } = compile("/a:b");

			expect(paramKeys).toEqual([]);
			expect(regex.test("/a:b")).toBe(true);
			expect(regex.test("/aXb")).toBe(false);
		});

		it("should compile non-ASCII route spelling to the utf-8 escapes a request carries", () => {
			const { paramKeys, regex } = compile("/café");

			expect(paramKeys).toEqual([]);
			expect(regex.test("/caf%C3%A9")).toBe(true);
			expect(regex.test("/café")).toBe(false);
			expect(regex.test("/cafe")).toBe(false);
		});

		it("should compile both spellings of the same non-ASCII route to one pattern", () => {
			expect(pathToRegexp("/café").pattern).toBe(
				pathToRegexp("/caf%C3%A9").pattern,
			);
		});

		it("should preserve the spelling and casing of an encoded route", () => {
			const { regex } = compile("/caf%C3%A9");

			expect(regex.test("/caf%C3%A9")).toBe(true);
			expect(regex.test("/caf%c3%a9")).toBe(false);
			expect(regex.test("/café")).toBe(false);
		});

		it("should compile a space the same way whether or not the route declares the encoding", () => {
			const raw = compile("/a b").regex;
			const encoded = compile("/a%20b").regex;

			expect(raw.test("/a%20b")).toBe(true);
			expect(raw.test("/a b")).toBe(false);
			expect(encoded.test("/a%20b")).toBe(true);
			expect(encoded.test("/a b")).toBe(false);
		});

		it("should make an optional literal segment optional in the regex", () => {
			const { regex } = compile("/a/b?");

			expect(regex.test("/a/b")).toBe(true);
			expect(regex.test("/a")).toBe(true);
		});

		it("should also match the empty string and the bare root when the only literal is optional", () => {
			const { pattern, regex } = compile("/a?");

			expect(pattern).toBe(String.raw`(?:(?:\/a)?|\/)()`);
			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/b")).toBe(false);
		});

		it("should make the trailing slash optional with a trailing '/?'", () => {
			const { regex } = compile("/a/?");

			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/a/")).toBe(true);
			expect(regex.test("/a/b")).toBe(false);
		});

		it("should compile a lone '?' segment to an optional empty literal", () => {
			const { paramKeys, pattern, regex, restKeys } = compile("/?");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(pattern).toBe(String.raw`(?:(?:\/)?|\/)()`);
			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/a")).toBe(false);
		});

		it("should treat a single leading '.' as a literal (not a rest param)", () => {
			const { paramKeys, regex, restKeys } = compile("/.a");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/.a")).toBe(true);
		});

		it("should treat two leading '..' (not three) as a literal", () => {
			const { paramKeys, regex, restKeys } = compile("/..a");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/..a")).toBe(true);
		});

		it("should treat '*' followed by more characters as a literal", () => {
			const { paramKeys, regex, restKeys } = compile("/*a");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/*a")).toBe(true);
			expect(regex.test("/a")).toBe(false);
		});

		it("should treat '**' as a literal segment, not a wildcard", () => {
			const { paramKeys, regex, restKeys } = compile("/**");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/**")).toBe(true);
			expect(regex.test("/v1/v2")).toBe(false);
		});
	});

	describe(":name required parameter", () => {
		describe("with path '/a/:p1'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/a/:p1");
			});

			it("should capture the required param value", () => {
				expect(compiled.paramKeys).toEqual(["p1"]);
				expect(compiled.restKeys).toEqual([]);

				const match = "/a/v1".match(compiled.regex);

				expect(match?.[1]).toBe("v1");
			});

			it("should not match without the required param value", () => {
				expect(compiled.regex.test("/a")).toBe(false);
				expect(compiled.regex.test("/a/")).toBe(false);
			});

			it("should reject a value containing whitespace, '?', or '#'", () => {
				expect(compiled.regex.test("/a/v1 v2")).toBe(false);
				expect(compiled.regex.test("/a/v1?v2")).toBe(false);
				expect(compiled.regex.test("/a/v1#v2")).toBe(false);
			});

			it("should not let a single param value span a '/' segment boundary", () => {
				expect(compiled.regex.test("/a/v1/v2")).toBe(false);
			});

			it("should accept percent-encoded characters in a param value", () => {
				expect("/a/v1%20v2".match(compiled.regex)?.[1]).toBe("v1%20v2");
			});

			it("should capture non-ASCII characters in a param value", () => {
				expect("/a/☕".match(compiled.regex)?.[1]).toBe("☕");
			});

			it("should build the documented params object via Object.fromEntries", () => {
				const match = "/a/v1".match(compiled.regex);

				const params = Object.fromEntries(
					compiled.paramKeys.map((key, i) => [key, match?.[i + 1]]),
				);

				expect(params).toEqual({ p1: "v1" });
			});
		});

		it("should capture multiple named params in order", () => {
			const { paramKeys, regex } = compile("/a/:p1/b/:p2");

			expect(paramKeys).toEqual(["p1", "p2"]);

			const match = "/a/v1/b/v2".match(regex);

			expect(match?.[1]).toBe("v1");
			expect(match?.[2]).toBe("v2");
		});

		it("should keep duplicate param names as separate paramKeys entries", () => {
			const { paramKeys, regex } = compile("/:p1/:p1");

			expect(paramKeys).toEqual(["p1", "p1"]);

			const match = "/v1/v2".match(regex);

			expect(match?.length).toBe(4);
			expect(match?.[1]).toBe("v1");
			expect(match?.[2]).toBe("v2");
		});

		it("should give a duplicated name its own capture when one is a rest param", () => {
			const { paramKeys, regex, restKeys } = compile("/:p1/...p1");

			expect(paramKeys).toEqual(["p1", "p1"]);
			expect(restKeys).toEqual(["p1"]);

			const match = "/v1/v2/v3".match(regex);

			expect(match?.length).toBe(4);
			expect(match?.[1]).toBe("v1");
			expect(match?.[2]).toBe("v2/v3");
		});

		it("should support a ':' segment with no name (empty key)", () => {
			const { paramKeys } = compile("/:");

			expect(paramKeys).toEqual([""]);
		});

		it("should support a ':' segment with empty name at a non-root position", () => {
			const { paramKeys, regex } = compile("/a/:");

			expect(paramKeys).toEqual([""]);
			expect(regex.test("/a/v1")).toBe(true);
			expect("/a/v1".match(regex)?.[1]).toBe("v1");
		});
	});

	describe(":name? optional parameter", () => {
		it("should match both with and without the param", () => {
			const { paramKeys, regex, restKeys } = compile("/a/:p1?");

			expect(paramKeys).toEqual(["p1"]);
			expect(restKeys).toEqual([]);

			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/a/v1")).toBe(true);

			const match = "/a/v1".match(regex);

			expect(match?.[1]).toBe("v1");

			const missing = "/a".match(regex);

			expect(missing?.[1]).toBeUndefined();
		});

		it("should support an optional :name? at the root", () => {
			const { regex } = compile("/:p1?");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/v1")).toBe(true);
		});

		it("should match the bare root slash when every segment is optional", () => {
			const { regex } = compile("/:p1?");

			expect(regex.test("/")).toBe(true);
			expect("/".match(regex)?.[1]).toBeUndefined();
		});

		it("should still require the literal when only the param is optional", () => {
			const { regex } = compile("/a/:p1?");

			expect(regex.test("/")).toBe(false);
		});

		it("should match every arity of an all-optional multi-param path", () => {
			const { regex } = compile("/:p1?/:p2?");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/v1")).toBe(true);
			expect(regex.test("/v1/v2")).toBe(true);

			const match = "/v1".match(regex);

			expect(match?.[1]).toBe("v1");
			expect(match?.[2]).toBeUndefined();
		});

		it("should not match more segments than an all-optional path declares", () => {
			const single = compile("/:p1?");

			expect(single.regex.test("/v1/v2")).toBe(false);

			const double = compile("/:p1?/:p2?");

			expect(double.regex.test("/v1/v2/v3")).toBe(false);
		});
	});

	describe("...name rest parameter", () => {
		describe("with path '/a/...r1'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/a/...r1");
			});

			it("should capture one or more remaining segments", () => {
				expect(compiled.paramKeys).toEqual(["r1"]);
				expect(compiled.restKeys).toEqual(["r1"]);

				expect("/a/v1".match(compiled.regex)?.[1]).toBe("v1");
				expect("/a/v1/v2/v3".match(compiled.regex)?.[1]).toBe(
					"v1/v2/v3",
				);
			});

			it("should require at least one segment after the prefix", () => {
				expect(compiled.regex.test("/a")).toBe(false);
				expect(compiled.regex.test("/a/")).toBe(false);
			});

			it("should reject a trailing slash after the rest segments, unlike '*'", () => {
				expect(compiled.regex.test("/a/v1/")).toBe(false);
			});

			it("should reject forbidden characters in rest segments", () => {
				expect(compiled.regex.test("/a/v1 v2")).toBe(false);
				expect(compiled.regex.test("/a/v1?v2")).toBe(false);
				expect(compiled.regex.test("/a/v1#v2")).toBe(false);
			});
		});

		it("should backtrack correctly when followed by literal segments", () => {
			const { paramKeys, regex, restKeys } = compile("/...r1/a");

			expect(paramKeys).toEqual(["r1"]);
			expect(restKeys).toEqual(["r1"]);

			const deep = "/v1/v2/v3/a".match(regex);

			expect(deep?.[1]).toBe("v1/v2/v3");

			const shallow = "/v1/a".match(regex);

			expect(shallow?.[1]).toBe("v1");

			expect(regex.test("/v1/v2/v3")).toBe(false);
		});

		it("should collect every rest param key when multiple rest are present", () => {
			const { paramKeys, restKeys } = compile("/...r1/a/...r2");

			expect(paramKeys).toEqual(["r1", "r2"]);
			expect(restKeys).toEqual(["r1", "r2"]);
		});

		it("should split segments between two adjacent required rest params", () => {
			const { paramKeys, regex, restKeys } = compile("/...r1/...r2");

			expect(paramKeys).toEqual(["r1", "r2"]);
			expect(restKeys).toEqual(["r1", "r2"]);

			// the greedy first rest gives back one segment
			const match = "/v1/v2/v3".match(regex);

			expect(match?.[1]).toBe("v1/v2");
			expect(match?.[2]).toBe("v3");

			// the param captures sit before the trailing marker
			expect("/v1/v2".match(regex)?.slice(1, -1)).toEqual(["v1", "v2"]);
			expect(regex.test("/v1")).toBe(false);
		});

		it("should never capture a second adjacent rest param when both are optional", () => {
			const { regex } = compile("/...r1?/...r2?");

			// the greedy first rest keeps every segment
			const deep = "/v1/v2/v3".match(regex);

			expect(deep?.[1]).toBe("v1/v2/v3");
			expect(deep?.[2]).toBeUndefined();

			const shallow = "/v1/v2".match(regex);

			expect(shallow?.[1]).toBe("v1/v2");
			expect(shallow?.[2]).toBeUndefined();

			const root = "/".match(regex);

			expect(root?.length).toBe(4);
			expect(root?.[1]).toBeUndefined();
			expect(root?.[2]).toBeUndefined();
		});

		it("should distribute segments across multiple rest params around a literal", () => {
			const { regex } = compile("/...r1/a/...r2");

			const match = "/v1/v2/a/v3".match(regex);

			expect(match).not.toBeNull();
			// the marker closes the pattern after both captures
			expect(match?.[3]).toBe("");
			expect(match?.[1]).toBe("v1/v2");
			expect(match?.[2]).toBe("v3");
		});

		it("should preserve capture distribution across three rest params", () => {
			const { regex } = compile("/...r1/a/...r2/b/...r3");
			const match = "/v1/v2/a/v3/v4/b/v5/v6".match(regex);

			expect(match?.slice(1, -1)).toEqual(["v1/v2", "v3/v4", "v5/v6"]);
		});

		it("should support an empty rest name", () => {
			const { paramKeys, restKeys } = compile("/...");

			expect(paramKeys).toEqual([""]);
			expect(restKeys).toEqual([""]);
		});

		it("should treat more than three leading dots as part of the rest name", () => {
			const { paramKeys, restKeys } = compile("/....r1");

			expect(paramKeys).toEqual([".r1"]);
			expect(restKeys).toEqual([".r1"]);
		});
	});

	describe("...name? optional rest parameter", () => {
		it("should match with and without trailing segments", () => {
			const { paramKeys, regex, restKeys } = compile("/a/...r1?");

			expect(paramKeys).toEqual(["r1"]);
			expect(restKeys).toEqual(["r1"]);

			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/a/v1/v2")).toBe(true);

			const match = "/a/v1/v2".match(regex);

			expect(match?.[1]).toBe("v1/v2");

			const missing = "/a".match(regex);

			expect(missing?.[1]).toBeUndefined();
		});

		it("should reject the bare prefix with a trailing slash, unlike '*?'", () => {
			const { regex } = compile("/a/...r1?");

			expect(regex.test("/a/")).toBe(false);
		});

		it("should support an optional rest with no name", () => {
			const { paramKeys, regex, restKeys } = compile("/...?");

			expect(paramKeys).toEqual([""]);
			expect(restKeys).toEqual([""]);

			expect(regex.test("")).toBe(true);
			expect(regex.test("/v1")).toBe(true);
			expect(regex.test("/v1/v2/v3")).toBe(true);

			const match = "/v1/v2/v3".match(regex);

			expect(match?.[1]).toBe("v1/v2/v3");

			const missing = "".match(regex);

			expect(missing?.[1]).toBeUndefined();
		});

		it("should match the bare root slash for an all-optional rest pattern", () => {
			const { regex } = compile("/...r1?");

			expect(regex.test("/")).toBe(true);
			expect("/".match(regex)?.[1]).toBeUndefined();
		});
	});

	describe("* wildcard segment", () => {
		describe("with path '/a/*'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/a/*");
			});

			it("should match one or more segments without capturing", () => {
				expect(compiled.paramKeys).toEqual([]);
				expect(compiled.restKeys).toEqual([]);

				expect(compiled.regex.test("/a/v1")).toBe(true);
				expect(compiled.regex.test("/a/v1/v2/v3")).toBe(true);
			});

			it("should match the bare prefix with a trailing slash", () => {
				expect(compiled.regex.test("/a/")).toBe(true);
				expect(compiled.regex.test("/a/v1/")).toBe(true);
			});

			it("should reject the bare prefix without a trailing slash", () => {
				expect(compiled.regex.test("/a")).toBe(false);
			});

			it("should not add extra capture groups", () => {
				const match = "/a/v1/v2".match(compiled.regex);

				expect(compiled.paramKeys).toEqual([]);
				expect(match?.length).toBe(2);
			});

			it("should reject segments containing whitespace, '?', or '#'", () => {
				expect(compiled.regex.test("/a/v1 v2")).toBe(false);
				expect(compiled.regex.test("/a/v1?v2")).toBe(false);
				expect(compiled.regex.test("/a/v1#v2")).toBe(false);
			});
		});

		it("should compile a bare '/*' catch-all that matches any non-empty path", () => {
			const { paramKeys, regex, restKeys } = compile("/*");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/v1")).toBe(true);
			expect(regex.test("/v1/v2")).toBe(true);
			expect(regex.test("")).toBe(false);
		});

		it("should match '//a' but not '/a' when a literal follows the wildcard", () => {
			const { regex } = compile("/*/a");

			expect(regex.test("/v1/a")).toBe(true);
			expect(regex.test("/a")).toBe(false);
			expect(regex.test("//a")).toBe(true);
		});

		it("should swallow empty segments in a terminal wildcard, like Bun's router", () => {
			// a terminal "*" takes the whole remainder
			const { pattern, regex } = compile("/a/*");

			expect(pattern).toBe(String.raw`\/a\/[^\s?#]*()`);
			expect(regex.test("/a//v1")).toBe(true);
			expect(regex.test("/a///")).toBe(true);
		});

		it("should keep requiring non-empty segments in a non-terminal wildcard", () => {
			const { pattern, regex } = compile("/a/*/b");

			expect(pattern).toBe(
				String.raw`\/a\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?\/b()`,
			);
			expect(regex.test("/a/v1/b")).toBe(true);
			expect(regex.test("/a/v1/v2/b")).toBe(true);
			expect(regex.test("/a//v1/b")).toBe(false);
		});

		it("should treat a wildcard followed only by separators as terminal", () => {
			expect(pathToRegexp("/a/*/").pattern).toBe(
				String.raw`\/a\/[^\s?#]*()`,
			);
		});
	});

	describe("*? optional wildcard", () => {
		describe("with path '/a/*?'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/a/*?");
			});

			it("should match with and without the wildcard tail", () => {
				expect(compiled.paramKeys).toEqual([]);
				expect(compiled.restKeys).toEqual([]);

				expect(compiled.regex.test("/a")).toBe(true);
				expect(compiled.regex.test("/a/v1/v2")).toBe(true);
			});

			it("should not add extra capture groups whether the tail is present or absent", () => {
				expect("/a/v1/v2".match(compiled.regex)?.length).toBe(2);
				expect("/a".match(compiled.regex)?.length).toBe(2);
			});

			it("should match the bare prefix with a trailing slash, unlike '...name?'", () => {
				expect(compiled.regex.test("/a/")).toBe(true);
			});
		});

		it("should compile a bare '/*?' that matches the empty string, the root, and any path", () => {
			const { paramKeys, regex, restKeys } = compile("/*?");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/v1")).toBe(true);
			expect(regex.test("/v1/v2")).toBe(true);
			expect("/v1".match(regex)?.length).toBe(2);
		});
	});

	describe("mixed segment types", () => {
		it("should support literals, named params and rest combined", () => {
			const { paramKeys, regex, restKeys } = compile("/a/:p1/b/...r1");

			expect(paramKeys).toEqual(["p1", "r1"]);
			expect(restKeys).toEqual(["r1"]);

			const match = "/a/v1/b/v2/v3/v4".match(regex);

			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("v1");
			expect(match?.[2]).toBe("v2/v3/v4");
		});

		it("should support optional named params alongside required ones", () => {
			const { paramKeys, regex } = compile("/a/:p1/:p2?");

			expect(paramKeys).toEqual(["p1", "p2"]);
			expect(regex.test("/a/v1")).toBe(true);
			expect(regex.test("/a/v1/v2")).toBe(true);
			expect("/a/v1/v2".match(regex)?.[2]).toBe("v2");
		});

		it("should keep capture indexes aligned when a wildcard precedes a param", () => {
			const { paramKeys, regex, restKeys } = compile("/a/*/:p1");

			expect(paramKeys).toEqual(["p1"]);
			expect(restKeys).toEqual([]);

			const match = "/a/v1/v2/v3".match(regex);

			// the wildcard adds no capture group
			expect(match?.length).toBe(3);
			expect(match?.[1]).toBe("v3");
			expect("/a/v1/v2".match(regex)?.[1]).toBe("v2");
		});

		it("should keep capture indexes aligned when a wildcard sits between a param and a rest", () => {
			const { paramKeys, regex, restKeys } = compile("/a/:p1/*/...r1");

			expect(paramKeys).toEqual(["p1", "r1"]);
			expect(restKeys).toEqual(["r1"]);

			const match = "/a/v1/v2/v3/v4".match(regex);

			expect(match?.length).toBe(4);
			expect(match?.[1]).toBe("v1");
			// the greedy wildcard leaves the rest one segment
			expect(match?.[2]).toBe("v4");
		});

		it("should preserve left-to-right paramKeys order across mixed segments", () => {
			const { paramKeys } = compile("/:p1/a/:p2/...r1/:p3");

			expect(paramKeys).toEqual(["p1", "p2", "r1", "p3"]);
		});

		it("should append exactly 1 + paramKeys.length capture groups", () => {
			const { paramKeys, regex } = compile("/a/:p1/:p2");
			const match = "/a/v1/v2".match(regex);

			expect(match).not.toBeNull();
			expect(paramKeys).toHaveLength(2);
			expect(match?.length).toBe(1 + 1 + paramKeys.length);
			// the marker closes the pattern after both captures
			expect(match?.[3]).toBe("");
			expect(match?.[1]).toBe("v1");
			expect(match?.[2]).toBe("v2");
		});

		it("should support an optional named param before a later literal segment", () => {
			const { paramKeys, regex } = compile("/a/:p1?/b");

			expect(paramKeys).toEqual(["p1"]);
			expect(regex.test("/a/v1/b")).toBe(true);
			expect(regex.test("/a/b")).toBe(true);
			expect("/a/v1/b".match(regex)?.[1]).toBe("v1");
			expect("/a/b".match(regex)?.[1]).toBeUndefined();
		});

		it("should support an optional rest param before a later literal segment", () => {
			const { paramKeys, regex, restKeys } = compile("/...r1?/a");

			expect(paramKeys).toEqual(["r1"]);
			expect(restKeys).toEqual(["r1"]);
			expect(regex.test("/a")).toBe(true);
			expect("/v1/v2/a".match(regex)?.[1]).toBe("v1/v2");
			expect("/a".match(regex)?.[1]).toBeUndefined();
		});
	});

	describe("embedded in the combined request-url pattern", () => {
		// mirrors how src/core/compile.ts embeds a pattern
		const embed = (path: string): RegExp =>
			new RegExp(
				`^(?:https?:\\/\\/)[^\\s\\/]+(?:${pathToRegexp(path).pattern})(?![^?#])`,
				"u",
			);

		it("should stop a param capture right before the query string", () => {
			const regex = embed("/a/:p1");

			expect("http://localhost/a/v1?b=1".match(regex)?.[1]).toBe("v1");
			expect("http://localhost/a/v1".match(regex)?.[1]).toBe("v1");
		});

		it("should stop a param capture right before the fragment", () => {
			const regex = embed("/a/:p1");

			expect("http://localhost/a/v1#c".match(regex)?.[1]).toBe("v1");
		});

		it("should stop a rest capture right before the query string or fragment", () => {
			const regex = embed("/a/...r1");

			expect("http://localhost/a/v1/v2?b=1".match(regex)?.[1]).toBe(
				"v1/v2",
			);
			expect("http://localhost/a/v1/v2#c".match(regex)?.[1]).toBe(
				"v1/v2",
			);
		});

		it("should stop a wildcard right before the query string or fragment", () => {
			const regex = embed("/a/*");

			const withQuery = "http://localhost/a/v1/v2?b=1".match(regex);

			expect(withQuery?.[0]).toBe("http://localhost/a/v1/v2");
			expect(withQuery?.length).toBe(2);

			expect("http://localhost/a/v1/v2#c".match(regex)?.[0]).toBe(
				"http://localhost/a/v1/v2",
			);
		});

		it.each([..."\"$%&'()*+,-./:;<=>@[\\]^_`{|}~ !"])(
			"should match the pathname the parser builds for the literal %j",
			(character) => {
				const regex = embed(`/a${character}b`);
				const { pathname } = new URL(`http://localhost/a${character}b`);

				expect(regex.test(`http://localhost${pathname}`)).toBe(true);
			},
		);

		it.each(["\t", "\n", "\r", "?", "#"])(
			"should compile the literal %j only in its encoded spelling",
			(character) => {
				const regex = embed(`/a${character}b`);
				const { pathname } = new URL(`http://localhost/a${character}b`);

				expect(
					regex.test(
						`http://localhost/a${encodeURIComponent(character)}b`,
					),
				).toBe(true);
				expect(regex.test(`http://localhost${pathname}`)).toBe(false);
			},
		);

		it("should match a fully optional pattern the same cold and hot", () => {
			// a fully optional route emits a mid-empty alternative
			const regex = embed("/:p1?");

			let matchedRoot = 0;
			let matchedParam = 0;

			for (let i = 0; i < 50_000; i++) {
				if (regex.test("http://localhost/")) {
					matchedRoot++;
				}

				if (regex.exec("http://localhost/v1")?.[1] === "v1") {
					matchedParam++;
				}
			}

			expect(matchedRoot).toBe(50_000);
			expect(matchedParam).toBe(50_000);
		});

		it("should not match when unconsumed path segments remain", () => {
			expect(embed("/a/:p1").test("http://localhost/a/v1/v2")).toBe(
				false,
			);
		});
	});

	describe("ranks", () => {
		it("should rank literal, param, wildcard, and rest segments in that order", () => {
			expect(pathToRegexp("/a/:p1/*/...r1").ranks).toEqual([0, 1, 2, 3]);
		});

		it("should not change a segment's rank when it is optional", () => {
			expect(pathToRegexp("/a?/:p1?/*?/...r1?").ranks).toEqual([
				0, 1, 2, 3,
			]);
		});

		it("should rank a terminal wildcard behind every other segment kind", () => {
			expect(pathToRegexp("/a/*").ranks).toEqual([0, 4]);
			expect(pathToRegexp("/a/*?").ranks).toEqual([0, 4]);
			expect(pathToRegexp("/*").ranks).toEqual([4]);
		});

		it("should keep a non-terminal wildcard ahead of a rest parameter", () => {
			expect(pathToRegexp("/a/*/b").ranks).toEqual([0, 2, 0]);
			expect(pathToRegexp("/a/...r1").ranks).toEqual([0, 3]);
			expect(pathToRegexp("/a/*/*").ranks).toEqual([0, 2, 4]);
		});

		it("should return no ranks for the root path", () => {
			expect(pathToRegexp("/").ranks).toEqual([]);
		});

		it("should return no ranks for the empty path or a slashes-only path", () => {
			expect(pathToRegexp("").ranks).toEqual([]);
			expect(pathToRegexp("//").ranks).toEqual([]);
		});

		it("should rank optional empty literal segments as static", () => {
			expect(pathToRegexp("/?").ranks).toEqual([0]);
			expect(pathToRegexp("/a/?").ranks).toEqual([0, 0]);
		});
	});

	describe("param flags", () => {
		it("should expose flags whose sums stay distinct", () => {
			expect(PARAM_FLAG_OPTIONAL).toBe(1);
			expect(PARAM_FLAG_REST).toBe(2);
			expect(
				new Set([
					0,
					PARAM_FLAG_OPTIONAL,
					PARAM_FLAG_REST,
					PARAM_FLAG_REST + PARAM_FLAG_OPTIONAL,
				]).size,
			).toBe(4);
		});

		it("should align required and optional flags with duplicate names", () => {
			const { paramFlags, paramKeys } = pathToRegexp(
				"/:p1/:p1?/...p1/...p1?",
			);

			expect(paramKeys).toEqual(["p1", "p1", "p1", "p1"]);
			expect(paramFlags).toEqual([0, 1, 2, 3]);
		});

		it("should return no param flags when the path has no captures", () => {
			expect(pathToRegexp("/").paramFlags).toEqual([]);
			expect(pathToRegexp("/a/*").paramFlags).toEqual([]);
		});
	});
	describe("exact output", () => {
		const cases: [
			path: string,
			pattern: string,
			paramKeys: string[],
			paramFlags: number[],
			ranks: number[],
			restKeys: string[],
		][] = [
			[
				"a",
				String.raw`\/a()`,
				[],
				[],
				[0],
				[],
			],
			[
				"a/b",
				String.raw`\/a\/b()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"//a//b//",
				String.raw`\/a\/b()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"\\a\\b",
				String.raw`\/a\/b()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"/a\\/b",
				String.raw`\/a\/b()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"/a/\\",
				String.raw`\/a()`,
				[],
				[],
				[0],
				[],
			],
			[
				"\\",
				String.raw`\/()`,
				[],
				[],
				[],
				[],
			],
			[
				"\\\\",
				String.raw`\/()`,
				[],
				[],
				[],
				[],
			],
			[
				"/\\/",
				String.raw`\/()`,
				[],
				[],
				[],
				[],
			],
			[
				"a\\:p1\\*",
				String.raw`\/a\/([^/\s?#]+)\/[^\s?#]*()`,
				["p1"],
				[0],
				[0, 1, 4],
				[],
			],
			[
				"/a/*\\",
				String.raw`\/a\/[^\s?#]*()`,
				[],
				[],
				[0, 4],
				[],
			],
			[
				"/a/*/\\/",
				String.raw`\/a\/[^\s?#]*()`,
				[],
				[],
				[0, 4],
				[],
			],
			[
				"/a/*?/b",
				String.raw`\/a(?:\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?)?\/b()`,
				[],
				[],
				[0, 2, 0],
				[],
			],
			[
				"/*?/",
				String.raw`(?:(?:\/[^\s?#]*)?|\/)()`,
				[],
				[],
				[4],
				[],
			],
			[
				"/*/*",
				String.raw`\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?\/[^\s?#]*()`,
				[],
				[],
				[2, 4],
				[],
			],
			[
				"/*?/*?",
				String.raw`(?:(?:\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?)?(?:\/[^\s?#]*)?|\/)()`,
				[],
				[],
				[2, 4],
				[],
			],
			[
				"/a*",
				String.raw`\/a\*()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/*a",
				String.raw`\/\*a()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/*??",
				String.raw`(?:(?:\/\*%3F)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/**?",
				String.raw`(?:(?:\/\*\*)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/*/:p1?",
				String.raw`\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?(?:\/([^/\s?#]+))?()`,
				["p1"],
				[1],
				[2, 1],
				[],
			],
			[
				"/:p1?/b",
				String.raw`(?:\/([^/\s?#]+))?\/b()`,
				["p1"],
				[1],
				[1, 0],
				[],
			],
			[
				"/:?",
				String.raw`(?:(?:\/([^/\s?#]+))?|\/)()`,
				[""],
				[1],
				[1],
				[],
			],
			[
				"/:",
				String.raw`\/([^/\s?#]+)()`,
				[""],
				[0],
				[1],
				[],
			],
			[
				"/::p1",
				String.raw`\/([^/\s?#]+)()`,
				[":p1"],
				[0],
				[1],
				[],
			],
			[
				"/:p1:p2",
				String.raw`\/([^/\s?#]+)()`,
				["p1:p2"],
				[0],
				[1],
				[],
			],
			[
				"/:p1.json",
				String.raw`\/([^/\s?#]+)()`,
				["p1.json"],
				[0],
				[1],
				[],
			],
			[
				"/:p-1",
				String.raw`\/([^/\s?#]+)()`,
				["p-1"],
				[0],
				[1],
				[],
			],
			[
				"/:é",
				String.raw`\/([^/\s?#]+)()`,
				["é"],
				[0],
				[1],
				[],
			],
			[
				"/:p1??",
				String.raw`(?:(?:\/([^/\s?#]+))?|\/)()`,
				["p1?"],
				[1],
				[1],
				[],
			],
			[
				"/:*",
				String.raw`\/([^/\s?#]+)()`,
				["*"],
				[0],
				[1],
				[],
			],
			[
				"/:...r1",
				String.raw`\/([^/\s?#]+)()`,
				["...r1"],
				[0],
				[1],
				[],
			],
			[
				"/...",
				String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))()`,
				[""],
				[2],
				[3],
				[""],
			],
			[
				"/...?",
				String.raw`(?:(?:\/((?:[^/\s?#]+/)*(?:[^/\s?#]+)))?|\/)()`,
				[""],
				[3],
				[3],
				[""],
			],
			[
				"/....r1",
				String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))()`,
				[".r1"],
				[2],
				[3],
				[".r1"],
			],
			[
				"/..?",
				String.raw`(?:(?:\/\.\.)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/..",
				String.raw`\/\.\.()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/.",
				String.raw`\/\.()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/.?",
				String.raw`(?:(?:\/\.)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/...r1/b",
				String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))\/b()`,
				["r1"],
				[2],
				[3, 0],
				["r1"],
			],
			[
				"/...r1?/...r2?",
				String.raw`(?:(?:\/((?:[^/\s?#]+/)*(?:[^/\s?#]+)))?(?:\/((?:[^/\s?#]+/)*(?:[^/\s?#]+)))?|\/)()`,
				["r1", "r2"],
				[3, 3],
				[3, 3],
				["r1", "r2"],
			],
			[
				"/...:p1",
				String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))()`,
				[":p1"],
				[2],
				[3],
				[":p1"],
			],
			[
				"/...*",
				String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))()`,
				["*"],
				[2],
				[3],
				["*"],
			],
			[
				"/?",
				String.raw`(?:(?:\/)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/??",
				String.raw`(?:(?:\/%3F)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a??",
				String.raw`(?:(?:\/a%3F)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a?b",
				String.raw`\/a%3Fb()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a?b?",
				String.raw`(?:(?:\/a%3Fb)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/?a",
				String.raw`\/%3Fa()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a?/b?",
				String.raw`(?:(?:\/a)?(?:\/b)?|\/)()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"/?/?",
				String.raw`(?:(?:\/)?(?:\/)?|\/)()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"/a/?/b",
				String.raw`\/a(?:\/)?\/b()`,
				[],
				[],
				[0, 0, 0],
				[],
			],
			[
				"/a.b",
				String.raw`\/a\.b()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/sitemap.xml",
				String.raw`\/sitemap\.xml()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/.well-known/openid-configuration",
				String.raw`\/\.well-known\/openid-configuration()`,
				[],
				[],
				[0, 0],
				[],
			],
			[
				"/a-b_c~d",
				String.raw`\/a-b_c~d()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a%20b",
				String.raw`\/a%20b()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a%2Fb",
				String.raw`\/a%2Fb()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a%",
				String.raw`\/a%()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a,b;c=d@e&f!g'h",
				String.raw`\/a,b;c=d@e&f!g'h()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a b",
				String.raw`\/a%20b()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a\tb",
				String.raw`\/a%09b()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a\u0080b",
				String.raw`\/a%C2%80b()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/café",
				String.raw`\/caf%C3%A9()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/日本語",
				String.raw`\/%E6%97%A5%E6%9C%AC%E8%AA%9E()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/😀",
				String.raw`\/%F0%9F%98%80()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a😀b",
				String.raw`\/a%F0%9F%98%80b()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/\ud800",
				String.raw`\/%EF%BF%BD()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a\udc00b",
				String.raw`\/a%EF%BF%BDb()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a\ud83d",
				String.raw`\/a%EF%BF%BD()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/\ude00\ud83d",
				String.raw`\/%EF%BF%BD%EF%BF%BD()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/a.b é(c)😀?",
				String.raw`(?:(?:\/a\.b%20%C3%A9\(c\)%F0%9F%98%80)?|\/)()`,
				[],
				[],
				[0],
				[],
			],
			[
				"/api/v1/organizations/:orgId/projects/:projectId/issues/:issueId/comments/:commentId?",
				String.raw`\/api\/v1\/organizations\/([^/\s?#]+)\/projects\/([^/\s?#]+)\/issues\/([^/\s?#]+)\/comments(?:\/([^/\s?#]+))?()`,
				["orgId", "projectId", "issueId", "commentId"],
				[0, 0, 0, 1],
				[0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
				[],
			],
		];

		for (let i = 0; i < cases.length; i++) {
			const [path, pattern, paramKeys, paramFlags, ranks, restKeys] =
				cases[i]!;

			it(`should compile ${JSON.stringify(path)}`, () => {
				expect(pathToRegexp(path)).toEqual({
					paramFlags,
					paramKeys,
					pattern,
					ranks,
					restKeys,
				});
			});
		}

		it("should escape, percent-encode or keep every ASCII character", () => {
			const escaped = "$()*+.[]|";
			const encoded = '"#<>?^`{}';

			for (let code = 0; code < 128; code++) {
				// "/" (47) and "\" (92) are separators
				if (code === 47 || code === 92) {
					continue;
				}

				const character = String.fromCharCode(code);

				let expected = character;

				if (escaped.includes(character)) {
					expected = `\\${character}`;
				} else if (
					code < 33 ||
					code === 127 ||
					encoded.includes(character)
				) {
					expected = `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
				}

				expect(pathToRegexp(`/a${character}b`).pattern).toBe(
					String.raw`\/a${expected}b()`,
				);
			}
		});

		it("should compile every escaped character of a run in one segment", () => {
			expect(pathToRegexp("/$()*+.[]|/a").pattern).toBe(
				String.raw`\/\$\(\)\*\+\.\[\]\|\/a()`,
			);
			expect(pathToRegexp('/"#<>^`{}/a').pattern).toBe(
				String.raw`\/%22%23%3C%3E%5E%60%7B%7D\/a()`,
			);
		});

		it("should encode adjacent non-ASCII characters and surrogates one by one", () => {
			expect(pathToRegexp("/é😀\uD800ñ\uDC00\uD83D😀").pattern).toBe(
				String.raw`\/%C3%A9%F0%9F%98%80%EF%BF%BD%C3%B1%EF%BF%BD%EF%BF%BD%F0%9F%98%80()`,
			);
		});

		it("should compile a long path segment by segment", () => {
			const count = 200;

			const { paramFlags, paramKeys, pattern, ranks, restKeys } =
				pathToRegexp("/s.1/:p1/*/...r1?".repeat(count));

			expect(pattern).toBe(
				`${String.raw`\/s\.1\/([^/\s?#]+)\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?(?:\/((?:[^/\s?#]+/)*(?:[^/\s?#]+)))?`.repeat(count)}()`,
			);
			expect(paramKeys).toEqual(
				Array.from({ length: count }, () => ["p1", "r1"]).flat(),
			);
			expect(paramFlags).toEqual(
				Array.from({ length: count }, () => [0, 3]).flat(),
			);
			expect(ranks).toEqual(
				Array.from({ length: count }, () => [0, 1, 2, 3]).flat(),
			);
			expect(restKeys).toEqual(
				Array.from({ length: count }, () => "r1"),
			);
		});

		it("should return fresh arrays on every call", () => {
			for (const path of ["/", "", "//", "/a/:p1/...r1"]) {
				const first = pathToRegexp(path);

				first.paramFlags.push(9);
				first.paramKeys.push("x");
				first.ranks.push(9);
				first.restKeys.push("x");

				const second = pathToRegexp(path);

				expect(second.paramFlags).not.toContain(9);
				expect(second.paramKeys).not.toContain("x");
				expect(second.ranks).not.toContain(9);
				expect(second.restKeys).not.toContain("x");
			}
		});

		it("should compile the same path to the same result on repeated calls", () => {
			const paths = ["/a.b/:p1?", "/a/*", "/é/...r1"];

			for (let i = 0; i < paths.length; i++) {
				const path = paths[i]!;

				expect(pathToRegexp(path)).toEqual(pathToRegexp(path));
				expect(pathToRegexp(path)).toEqual(pathToRegexp(path));
			}
		});
	});
});
