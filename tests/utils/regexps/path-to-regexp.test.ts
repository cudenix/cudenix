import { beforeAll, describe, expect, it } from "bun:test";

import {
	PARAM_FLAG_OPTIONAL,
	PARAM_FLAG_REST,
	pathToRegexp,
} from "@/utils/regexps/path-to-regexp";

const compile = (path: string) => {
	const { paramFlags, paramKeys, pattern, restKeys } = pathToRegexp(path);

	return {
		paramFlags,
		paramKeys,
		pattern,
		regex: new RegExp(`^${pattern}$`),
		restKeys,
	};
};

describe("pathToRegexp", () => {
	describe("root path '/'", () => {
		it("should return the special-case shape", () => {
			const result = pathToRegexp("/");

			expect(result.paramKeys).toEqual([]);
			expect(result.pattern).toBe(String.raw`()\/`);
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
			// the previous zero-width "()" pattern required an empty path, which
			// no HTTP client can send, so the route was silently dead
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

			expect("/a/v1".match(regex)?.[2]).toBe("v1");
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
			const symbols = [
				"(",
				")",
				"[",
				"]",
				"{",
				"}",
				"^",
				"+",
				"|",
				"$",
				"\\",
			];

			for (let i = 0; i < symbols.length; i++) {
				const path = `/a${symbols[i]}b`;

				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
				expect(regex.test("/aXb")).toBe(false);
				expect(regex.test("/ab")).toBe(false);
			}
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

		it("should keep constructor-safe punctuation and whitespace literal", () => {
			const segments = [
				"1abc",
				"a-b",
				"a,b",
				"a b",
				"a\nb",
				"a\rb",
				"a\u0000b",
				"a\u2028b",
			];

			for (let i = 0; i < segments.length; i++) {
				const path = `/${segments[i]}`;
				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
				expect(regex.test(`${path}x`)).toBe(false);
			}
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

			// a request path can only carry "?" encoded, so matching it raw would
			// reach into the query string and shadow the route "/a"; Bun's native
			// router also compares the spelling and hex casing of encoded paths
			expect(pattern).toBe(String.raw`()\/a%3Fb`);
			expect(regex.test("/a%3Fb")).toBe(true);
			expect(regex.test("/a%3fb")).toBe(false);
			expect(regex.test("/a?b")).toBe(false);
			expect(regex.test("/ab")).toBe(false);
		});

		it("should compile a '#' in the middle of a segment to its percent-encoding", () => {
			const { pattern, regex } = compile("/a#b");

			expect(pattern).toBe(String.raw`()\/a%23b`);
			expect(regex.test("/a%23b")).toBe(true);
			expect(regex.test("/a#b")).toBe(false);
		});

		it("should not let a '?' segment shadow the route the request actually asked for", () => {
			const shadowing = pathToRegexp("/a?b=1").pattern;
			const real = pathToRegexp("/a").pattern;
			const combined = new RegExp(
				`^(?:https?:\\/\\/)[^\\s\\/]+(?:${shadowing}|${real})(?![^?#])`,
			);

			// group 1 is the shadowing route's marker, group 2 the real one
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

		it("should preserve non-ASCII route spelling instead of encoding it implicitly", () => {
			const { paramKeys, regex } = compile("/café");

			expect(paramKeys).toEqual([]);
			expect(regex.test("/café")).toBe(true);
			expect(regex.test("/caf%C3%A9")).toBe(false);
			expect(regex.test("/cafe")).toBe(false);
		});

		it("should preserve the spelling and casing of an encoded route", () => {
			const { regex } = compile("/caf%C3%A9");

			// Bun requires static non-ASCII routes to be encoded and compares the
			// percent escapes byte-for-byte rather than normalizing their casing
			expect(regex.test("/caf%C3%A9")).toBe(true);
			expect(regex.test("/caf%c3%a9")).toBe(false);
			expect(regex.test("/café")).toBe(false);
		});

		it("should leave spaces unencoded unless the route declares the encoding", () => {
			const raw = compile("/a b").regex;
			const encoded = compile("/a%20b").regex;

			expect(raw.test("/a b")).toBe(true);
			expect(raw.test("/a%20b")).toBe(false);
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

			expect(pattern).toBe(String.raw`()(?:(?:\/a)?|\/)`);
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
			expect(pattern).toBe(String.raw`()(?:(?:\/)?|\/)`);
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

				expect(match?.[2]).toBe("v1");
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
				expect("/a/v1%20v2".match(compiled.regex)?.[2]).toBe("v1%20v2");
			});

			it("should capture non-ASCII characters in a param value", () => {
				expect("/a/☕".match(compiled.regex)?.[2]).toBe("☕");
			});

			it("should build the documented params object via Object.fromEntries", () => {
				const match = "/a/v1".match(compiled.regex);

				const params = Object.fromEntries(
					compiled.paramKeys.map((key, i) => [key, match?.[i + 2]]),
				);

				expect(params).toEqual({ p1: "v1" });
			});
		});

		it("should capture multiple named params in order", () => {
			const { paramKeys, regex } = compile("/a/:p1/b/:p2");

			expect(paramKeys).toEqual(["p1", "p2"]);

			const match = "/a/v1/b/v2".match(regex);

			expect(match?.[2]).toBe("v1");
			expect(match?.[3]).toBe("v2");
		});

		it("should keep duplicate param names as separate paramKeys entries", () => {
			const { paramKeys, regex } = compile("/:p1/:p1");

			expect(paramKeys).toEqual(["p1", "p1"]);

			const match = "/v1/v2".match(regex);

			expect(match?.length).toBe(4);
			expect(match?.[2]).toBe("v1");
			expect(match?.[3]).toBe("v2");
		});

		it("should give a duplicated name its own capture when one is a rest param", () => {
			const { paramKeys, regex, restKeys } = compile("/:p1/...p1");

			expect(paramKeys).toEqual(["p1", "p1"]);
			expect(restKeys).toEqual(["p1"]);

			const match = "/v1/v2/v3".match(regex);

			expect(match?.length).toBe(4);
			expect(match?.[2]).toBe("v1");
			expect(match?.[3]).toBe("v2/v3");
		});

		it("should support a ':' segment with no name (empty key)", () => {
			const { paramKeys } = compile("/:");

			expect(paramKeys).toEqual([""]);
		});

		it("should support a ':' segment with empty name at a non-root position", () => {
			const { paramKeys, regex } = compile("/a/:");

			expect(paramKeys).toEqual([""]);
			expect(regex.test("/a/v1")).toBe(true);
			expect("/a/v1".match(regex)?.[2]).toBe("v1");
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

			expect(match?.[2]).toBe("v1");

			const missing = "/a".match(regex);

			expect(missing?.[2]).toBeUndefined();
		});

		it("should support an optional :name? at the root", () => {
			const { regex } = compile("/:p1?");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/v1")).toBe(true);
		});

		it("should match the bare root slash when every segment is optional", () => {
			const { regex } = compile("/:p1?");

			expect(regex.test("/")).toBe(true);
			expect("/".match(regex)?.[2]).toBeUndefined();
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

			expect(match?.[2]).toBe("v1");
			expect(match?.[3]).toBeUndefined();
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

				expect("/a/v1".match(compiled.regex)?.[2]).toBe("v1");
				expect("/a/v1/v2/v3".match(compiled.regex)?.[2]).toBe(
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

			expect(deep?.[2]).toBe("v1/v2/v3");

			const shallow = "/v1/a".match(regex);

			expect(shallow?.[2]).toBe("v1");

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

			// the first rest is greedy, so it backtracks only the last segment
			const match = "/v1/v2/v3".match(regex);

			expect(match?.[2]).toBe("v1/v2");
			expect(match?.[3]).toBe("v3");

			expect("/v1/v2".match(regex)?.slice(2)).toEqual(["v1", "v2"]);
			expect(regex.test("/v1")).toBe(false);
		});

		it("should never capture a second adjacent rest param when both are optional", () => {
			const { regex } = compile("/...r1?/...r2?");

			// nothing forces the greedy first rest to give segments back
			const deep = "/v1/v2/v3".match(regex);

			expect(deep?.[2]).toBe("v1/v2/v3");
			expect(deep?.[3]).toBeUndefined();

			const shallow = "/v1/v2".match(regex);

			expect(shallow?.[2]).toBe("v1/v2");
			expect(shallow?.[3]).toBeUndefined();

			const root = "/".match(regex);

			expect(root?.length).toBe(4);
			expect(root?.[2]).toBeUndefined();
			expect(root?.[3]).toBeUndefined();
		});

		it("should distribute segments across multiple rest params around a literal", () => {
			const { regex } = compile("/...r1/a/...r2");

			const match = "/v1/v2/a/v3".match(regex);

			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("");
			expect(match?.[2]).toBe("v1/v2");
			expect(match?.[3]).toBe("v3");
		});

		it("should preserve capture distribution across three rest params", () => {
			const { regex } = compile("/...r1/a/...r2/b/...r3");
			const match = "/v1/v2/a/v3/v4/b/v5/v6".match(regex);

			expect(match?.slice(2)).toEqual(["v1/v2", "v3/v4", "v5/v6"]);
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

			expect(match?.[2]).toBe("v1/v2");

			const missing = "/a".match(regex);

			expect(missing?.[2]).toBeUndefined();
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

			expect(match?.[2]).toBe("v1/v2/v3");

			const missing = "".match(regex);

			expect(missing?.[2]).toBeUndefined();
		});

		it("should match the bare root slash for an all-optional rest pattern", () => {
			const { regex } = compile("/...r1?");

			expect(regex.test("/")).toBe(true);
			expect("/".match(regex)?.[2]).toBeUndefined();
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
			expect(match?.[2]).toBe("v1");
			expect(match?.[3]).toBe("v2/v3/v4");
		});

		it("should support optional named params alongside required ones", () => {
			const { paramKeys, regex } = compile("/a/:p1/:p2?");

			expect(paramKeys).toEqual(["p1", "p2"]);
			expect(regex.test("/a/v1")).toBe(true);
			expect(regex.test("/a/v1/v2")).toBe(true);
			expect("/a/v1/v2".match(regex)?.[3]).toBe("v2");
		});

		it("should keep capture indexes aligned when a wildcard precedes a param", () => {
			const { paramKeys, regex, restKeys } = compile("/a/*/:p1");

			expect(paramKeys).toEqual(["p1"]);
			expect(restKeys).toEqual([]);

			const match = "/a/v1/v2/v3".match(regex);

			// the wildcard consumes segments without adding a capture group
			expect(match?.length).toBe(3);
			expect(match?.[2]).toBe("v3");
			expect("/a/v1/v2".match(regex)?.[2]).toBe("v2");
		});

		it("should keep capture indexes aligned when a wildcard sits between a param and a rest", () => {
			const { paramKeys, regex, restKeys } = compile("/a/:p1/*/...r1");

			expect(paramKeys).toEqual(["p1", "r1"]);
			expect(restKeys).toEqual(["r1"]);

			const match = "/a/v1/v2/v3/v4".match(regex);

			expect(match?.length).toBe(4);
			expect(match?.[2]).toBe("v1");
			// the greedy wildcard leaves only the last segment to the rest param
			expect(match?.[3]).toBe("v4");
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
			expect(match?.[1]).toBe("");
			expect(match?.[2]).toBe("v1");
			expect(match?.[3]).toBe("v2");
		});

		it("should support an optional named param before a later literal segment", () => {
			const { paramKeys, regex } = compile("/a/:p1?/b");

			expect(paramKeys).toEqual(["p1"]);
			expect(regex.test("/a/v1/b")).toBe(true);
			expect(regex.test("/a/b")).toBe(true);
			expect("/a/v1/b".match(regex)?.[2]).toBe("v1");
			expect("/a/b".match(regex)?.[2]).toBeUndefined();
		});

		it("should support an optional rest param before a later literal segment", () => {
			const { paramKeys, regex, restKeys } = compile("/...r1?/a");

			expect(paramKeys).toEqual(["r1"]);
			expect(restKeys).toEqual(["r1"]);
			expect(regex.test("/a")).toBe(true);
			expect("/v1/v2/a".match(regex)?.[2]).toBe("v1/v2");
			expect("/a".match(regex)?.[2]).toBeUndefined();
		});
	});

	describe("embedded in the combined request-url pattern", () => {
		// mirrors how src/core/compile.ts embeds every pattern to match a full request url
		const embed = (path: string) =>
			new RegExp(
				`^(?:https?:\\/\\/)[^\\s\\/]+(?:${pathToRegexp(path).pattern})(?![^?#])`,
			);

		it("should stop a param capture right before the query string", () => {
			const regex = embed("/a/:p1");

			expect("http://localhost/a/v1?b=1".match(regex)?.[2]).toBe("v1");
			expect("http://localhost/a/v1".match(regex)?.[2]).toBe("v1");
		});

		it("should stop a param capture right before the fragment", () => {
			const regex = embed("/a/:p1");

			expect("http://localhost/a/v1#c".match(regex)?.[2]).toBe("v1");
		});

		it("should stop a rest capture right before the query string or fragment", () => {
			const regex = embed("/a/...r1");

			expect("http://localhost/a/v1/v2?b=1".match(regex)?.[2]).toBe(
				"v1/v2",
			);
			expect("http://localhost/a/v1/v2#c".match(regex)?.[2]).toBe(
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
		it("should expose the flags as disjoint bits", () => {
			expect(PARAM_FLAG_OPTIONAL).toBe(1);
			expect(PARAM_FLAG_REST).toBe(2);
			expect(PARAM_FLAG_OPTIONAL & PARAM_FLAG_REST).toBe(0);
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
});
