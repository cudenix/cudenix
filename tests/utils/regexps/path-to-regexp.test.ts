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
