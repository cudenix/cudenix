import { beforeAll, describe, expect, it } from "bun:test";

import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

const compile = (path: string) => {
	const { paramKeys, pattern, restKeys } = pathToRegexp(path);

	return { paramKeys, pattern, regex: new RegExp(`^${pattern}$`), restKeys };
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

		it("should compile a slashes-only path '//' like the empty path, not the root", () => {
			const { paramKeys, pattern, restKeys } = pathToRegexp("//");

			expect(paramKeys).toEqual([]);
			expect(pattern).toBe("()");
			expect(restKeys).toEqual([]);
		});
	});

	describe("literal segments", () => {
		it("should compile a single literal segment", () => {
			const { paramKeys, regex, restKeys } = compile("/a");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toEqual([]);
			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/b")).toBe(false);
			expect(regex.test("/a/1")).toBe(false);
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
			const symbols = ["(", ")", "[", "]", "{", "}", "^", "+", "|", "$"];

			for (let i = 0; i < symbols.length; i++) {
				const path = `/a${symbols[i]}b`;

				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
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

		it("should treat a '?' in the middle of a segment as a literal character", () => {
			const { regex } = compile("/a?b");

			expect(regex.test("/a?b")).toBe(true);
			expect(regex.test("/ab")).toBe(false);
		});

		it("should match literal segments with non-ASCII characters", () => {
			const { paramKeys, regex } = compile("/café");

			expect(paramKeys).toEqual([]);
			expect(regex.test("/café")).toBe(true);
			expect(regex.test("/cafe")).toBe(false);
		});

		it("should make an optional literal segment optional in the regex", () => {
			const { regex } = compile("/a/b?");

			expect(regex.test("/a/b")).toBe(true);
			expect(regex.test("/a")).toBe(true);
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
				expect(compiled.regex.test("/a/0 v1")).toBe(false);
				expect(compiled.regex.test("/a/0?v1")).toBe(false);
				expect(compiled.regex.test("/a/0#v1")).toBe(false);
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

			it("should match the bare prefix with a trailing slash, mirroring Bun's '/*'", () => {
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
});
