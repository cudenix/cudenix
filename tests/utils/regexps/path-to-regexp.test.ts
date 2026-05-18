import { describe, expect, test } from "bun:test";

import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

const compile = (path: string) => {
	const { paramKeys, pattern, restKeys } = pathToRegexp(path);

	return {
		paramKeys,
		pattern,
		regex: new RegExp(`^${pattern}$`),
		restKeys,
	};
};

describe("pathToRegexp", () => {
	describe("root path", () => {
		test("returns the special-case shape for '/'", () => {
			const result = pathToRegexp("/");

			expect(result.paramKeys).toEqual([]);
			expect(result.pattern).toBe(String.raw`()\/`);
			expect(result.restKeys).toBeUndefined();
		});

		test("compiled root regex matches '/'", () => {
			const { regex } = compile("/");

			expect(regex.test("/")).toBe(true);
			expect(regex.test("")).toBe(false);
			expect(regex.test("/a")).toBe(false);
		});
	});

	describe("empty path", () => {
		test("produces the seed-only pattern for ''", () => {
			const { paramKeys, pattern, restKeys } = pathToRegexp("");

			expect(paramKeys).toEqual([]);
			expect(pattern).toBe("()");
			expect(restKeys).toBeUndefined();
		});

		test("compiled regex matches only the empty string", () => {
			const { regex } = compile("");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(false);
			expect(regex.test("/a")).toBe(false);
		});
	});

	describe("literal segments", () => {
		test("compiles a single literal", () => {
			const { paramKeys, regex, restKeys } = compile("/users");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/users")).toBe(true);
			expect(regex.test("/user")).toBe(false);
			expect(regex.test("/users/1")).toBe(false);
		});

		test("compiles multiple literal segments", () => {
			const { regex } = compile("/api/v1/health");

			expect(regex.test("/api/v1/health")).toBe(true);
			expect(regex.test("/api/v1")).toBe(false);
			expect(regex.test("/api/v1/health/extra")).toBe(false);
		});

		test("ignores extra consecutive slashes between segments", () => {
			const { regex } = compile("//users");

			expect(regex.test("/users")).toBe(true);
		});

		test("ignores a trailing slash", () => {
			const { regex } = compile("/users/");

			expect(regex.test("/users")).toBe(true);
		});

		test("escapes regex-special characters in literal segments", () => {
			const { regex } = compile("/a.b");

			expect(regex.test("/a.b")).toBe(true);
			expect(regex.test("/aXb")).toBe(false);
		});

		test("treats a single leading '.' as a literal (not a rest param)", () => {
			const { paramKeys, regex, restKeys } = compile("/.well-known");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/.well-known")).toBe(true);
		});

		test("treats two leading '..' (not three) as a literal", () => {
			const { paramKeys, regex, restKeys } = compile("/..relative");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/..relative")).toBe(true);
		});

		test("treats '*' followed by more characters as a literal", () => {
			const { paramKeys, regex, restKeys } = compile("/*x");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/*x")).toBe(true);
			expect(regex.test("/anything")).toBe(false);
		});

		test("optional literal segment becomes optional in the regex", () => {
			const { regex } = compile("/users/details?");

			expect(regex.test("/users/details")).toBe(true);
			expect(regex.test("/users")).toBe(true);
		});

		test("escapes additional regex-special characters in literals", () => {
			const symbols = ["+", "(", ")", "[", "]", "{", "}", "^", "$", "|"];

			for (let i = 0; i < symbols.length; i++) {
				const path = `/a${symbols[i]}b`;

				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
			}
		});

		test("a '+' in a literal does not act as regex repetition", () => {
			const { regex } = compile("/a+b");

			expect(regex.test("/a+b")).toBe(true);
			expect(regex.test("/aaab")).toBe(false);
			expect(regex.test("/ab")).toBe(false);
		});

		test("normalizes a path without a leading '/' the same as one with it", () => {
			const withSlash = pathToRegexp("/users/:id");
			const withoutSlash = pathToRegexp("users/:id");

			expect(withoutSlash.pattern).toBe(withSlash.pattern);
			expect(withoutSlash.paramKeys).toEqual(withSlash.paramKeys);

			const { regex } = compile("users/:id");

			expect("/users/abc".match(regex)![2]).toBe("abc");
		});

		test("a lone '?' segment compiles to an optional empty literal", () => {
			const { paramKeys, pattern, regex, restKeys } = compile("/?");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(pattern).toBe(String.raw`()(?:\/)?`);
			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/a")).toBe(false);
		});

		test("a trailing '/?' on a literal makes the trailing slash optional", () => {
			const { regex } = compile("/foo/?");

			expect(regex.test("/foo")).toBe(true);
			expect(regex.test("/foo/")).toBe(true);
			expect(regex.test("/foo/bar")).toBe(false);
		});
	});

	describe(":name parameter", () => {
		test("captures a required param", () => {
			const { paramKeys, regex, restKeys } = compile("/users/:id");

			expect(paramKeys).toEqual(["id"]);
			expect(restKeys).toBeUndefined();

			const match = "/users/1".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("1");
		});

		test("does not match without the required param value", () => {
			const { regex } = compile("/users/:id");

			expect(regex.test("/users")).toBe(false);
			expect(regex.test("/users/")).toBe(false);
		});

		test("rejects values containing forbidden characters (/, whitespace, ?, #)", () => {
			const { regex } = compile("/users/:id");

			expect(regex.test("/users/0 1")).toBe(false);
			expect(regex.test("/users/0?1")).toBe(false);
			expect(regex.test("/users/0#1")).toBe(false);
			expect(regex.test("/users/a/b")).toBe(false);
		});

		test("captures multiple named params in order", () => {
			const { paramKeys, regex } = compile("/users/:user/posts/:post");

			expect(paramKeys).toEqual(["user", "post"]);

			const match = "/users/alice/posts/1".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("alice");
			expect(match![3]).toBe("1");
		});

		test("supports a ':' segment with no name (empty key)", () => {
			const { paramKeys } = compile("/:");

			expect(paramKeys).toEqual([""]);
		});

		test("supports a ':' segment with empty name at a non-root position", () => {
			const { paramKeys, regex } = compile("/foo/:");

			expect(paramKeys).toEqual([""]);
			expect(regex.test("/foo/anything")).toBe(true);
			expect("/foo/value".match(regex)![2]).toBe("value");
		});
	});

	describe(":name? optional parameter", () => {
		test("matches both with and without the param", () => {
			const { paramKeys, regex, restKeys } = compile("/posts/:slug?");

			expect(paramKeys).toEqual(["slug"]);
			expect(restKeys).toBeUndefined();

			expect(regex.test("/posts")).toBe(true);
			expect(regex.test("/posts/hello")).toBe(true);

			const match = "/posts/hello".match(regex);

			expect(match![2]).toBe("hello");

			const missing = "/posts".match(regex);

			expect(missing![2]).toBeUndefined();
		});

		test("optional :name? at the root", () => {
			const { regex } = compile("/:id?");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/abc")).toBe(true);
		});
	});

	describe("...name rest parameter", () => {
		test("captures one or more remaining segments", () => {
			const { paramKeys, regex, restKeys } = compile("/files/...path");

			expect(paramKeys).toEqual(["path"]);
			expect(restKeys).toEqual(["path"]);

			expect("/files/a".match(regex)![2]).toBe("a");
			expect("/files/a/b/c".match(regex)![2]).toBe("a/b/c");
		});

		test("requires at least one segment after the prefix", () => {
			const { regex } = compile("/files/...path");

			expect(regex.test("/files")).toBe(false);
			expect(regex.test("/files/")).toBe(false);
		});

		test("collects every rest param key (covers the !restKeys false branch)", () => {
			const { paramKeys, restKeys } = compile("/...a/middle/...b");

			expect(paramKeys).toEqual(["a", "b"]);
			expect(restKeys).toEqual(["a", "b"]);
		});

		test("supports an empty rest name", () => {
			const { paramKeys, restKeys } = compile("/...");

			expect(paramKeys).toEqual([""]);
			expect(restKeys).toEqual([""]);
		});

		test("rejects forbidden characters in rest segments", () => {
			const { regex } = compile("/files/...path");

			expect(regex.test("/files/a b")).toBe(false);
			expect(regex.test("/files/a?b")).toBe(false);
			expect(regex.test("/files/a#b")).toBe(false);
		});

		test("treats more than three leading dots as part of the rest name", () => {
			const { paramKeys, restKeys } = compile("/....name");

			expect(paramKeys).toEqual([".name"]);
			expect(restKeys).toEqual([".name"]);
		});

		test("rest backtracks correctly when followed by literal segments", () => {
			const { paramKeys, regex, restKeys } = compile("/...rest/end");

			expect(paramKeys).toEqual(["rest"]);
			expect(restKeys).toEqual(["rest"]);

			const deep = "/a/b/c/end".match(regex);

			expect(deep).not.toBeNull();
			expect(deep![2]).toBe("a/b/c");

			const shallow = "/a/end".match(regex);

			expect(shallow).not.toBeNull();
			expect(shallow![2]).toBe("a");

			expect(regex.test("/a/b/c")).toBe(false);
		});
	});

	describe("...name? optional rest parameter", () => {
		test("matches with and without trailing segments", () => {
			const { paramKeys, regex, restKeys } = compile("/files/...path?");

			expect(paramKeys).toEqual(["path"]);
			expect(restKeys).toEqual(["path"]);

			expect(regex.test("/files")).toBe(true);
			expect(regex.test("/files/a/b")).toBe(true);

			const match = "/files/a/b".match(regex);

			expect(match![2]).toBe("a/b");

			const missing = "/files".match(regex);

			expect(missing![2]).toBeUndefined();
		});

		test("supports an optional rest with no name", () => {
			const { paramKeys, regex, restKeys } = compile("/...?");

			expect(paramKeys).toEqual([""]);
			expect(restKeys).toEqual([""]);

			expect(regex.test("")).toBe(true);
			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/a/b/c")).toBe(true);

			const match = "/a/b/c".match(regex);

			expect(match![2]).toBe("a/b/c");

			const missing = "".match(regex);

			expect(missing![2]).toBeUndefined();
		});
	});

	describe("* wildcard segment", () => {
		test("matches one or more segments without capturing", () => {
			const { paramKeys, regex, restKeys } = compile("/static/*");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();

			expect(regex.test("/static/a")).toBe(true);
			expect(regex.test("/static/a/b/c")).toBe(true);
		});

		test("rejects when the wildcard segment is absent", () => {
			const { regex } = compile("/static/*");

			expect(regex.test("/static")).toBe(false);
		});

		test("the wildcard segment adds no extra capture groups", () => {
			const { paramKeys, regex } = compile("/static/*");
			const match = "/static/a/b".match(regex);

			expect(paramKeys).toEqual([]);
			expect(match!.length).toBe(2);
		});
	});

	describe("*? optional wildcard", () => {
		test("matches with and without the wildcard tail", () => {
			const { paramKeys, regex, restKeys } = compile("/static/*?");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();

			expect(regex.test("/static")).toBe(true);
			expect(regex.test("/static/a/b")).toBe(true);
		});

		test("the optional wildcard adds no extra capture groups when present", () => {
			const { paramKeys, regex } = compile("/static/*?");

			expect(paramKeys).toEqual([]);
			expect("/static/a/b".match(regex)!.length).toBe(2);
			expect("/static".match(regex)!.length).toBe(2);
		});
	});

	describe("mixed segment types", () => {
		test("supports literals, named params and rest combined", () => {
			const { paramKeys, regex, restKeys } = compile(
				"/api/:version/files/...path",
			);

			expect(paramKeys).toEqual(["version", "path"]);
			expect(restKeys).toEqual(["path"]);

			const match = "/api/v1/files/a/b/c".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("v1");
			expect(match![3]).toBe("a/b/c");
		});

		test("appends exactly 1 + paramKeys.length capture groups", () => {
			const { paramKeys, regex } = compile("/a/:b/:c");
			const match = "/a/foo/bar".match(regex);

			expect(match).not.toBeNull();
			expect(paramKeys).toHaveLength(2);
			expect(match!.length).toBe(1 + 1 + paramKeys.length);
			expect(match![1]).toBe("");
			expect(match![2]).toBe("foo");
			expect(match![3]).toBe("bar");
		});

		test("preserves left-to-right paramKeys order across mixed segments", () => {
			const { paramKeys } = compile(
				"/:first/middle/:second/...rest/:fourth",
			);

			expect(paramKeys).toEqual(["first", "second", "rest", "fourth"]);
		});

		test("supports optional named params alongside required ones", () => {
			const { paramKeys, regex } = compile("/u/:user/:tab?");

			expect(paramKeys).toEqual(["user", "tab"]);
			expect(regex.test("/u/alice")).toBe(true);
			expect(regex.test("/u/alice/settings")).toBe(true);
			expect("/u/alice/settings".match(regex)![3]).toBe("settings");
		});
	});

	describe("pattern string (JSDoc examples)", () => {
		test("matches the documented pattern for '/users/:id'", () => {
			const { pattern } = pathToRegexp("/users/:id");

			expect(pattern).toBe(String.raw`()\/\x75sers\/([^/\s?#]+)`);
		});

		test("matches the documented pattern for '/files/...path'", () => {
			const { pattern } = pathToRegexp("/files/...path");

			expect(pattern).toBe(
				String.raw`()\/\x66iles\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))`,
			);
		});

		test("matches the documented pattern for '/posts/:slug?'", () => {
			const { pattern } = pathToRegexp("/posts/:slug?");

			expect(pattern).toBe(String.raw`()\/\x70osts(?:\/([^/\s?#]+))?`);
		});
	});

	describe("unexpected input types", () => {
		test("throws for a null path", () => {
			expect(() => pathToRegexp(null as unknown as string)).toThrow(
				TypeError,
			);
		});

		test("throws for an undefined path", () => {
			expect(() => pathToRegexp(undefined as unknown as string)).toThrow(
				TypeError,
			);
		});

		test("treats a non-string value without length as an empty path", () => {
			const result = pathToRegexp(123 as unknown as string);

			expect(result).toEqual({
				paramKeys: [],
				pattern: "()",
				restKeys: undefined,
			});
		});

		test("throws for array-like values without string scanning methods", () => {
			expect(() =>
				pathToRegexp({ length: 1 } as unknown as string),
			).toThrow(TypeError);
		});
	});
});
