import { beforeAll, describe, expect, test } from "bun:test";

import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

const compile = (path: string) => {
	const { paramKeys, pattern, restKeys } = pathToRegexp(path);

	return { paramKeys, pattern, regex: new RegExp(`^${pattern}$`), restKeys };
};

describe("pathToRegexp", () => {
	describe("root path '/'", () => {
		test("should return the special-case shape", () => {
			const result = pathToRegexp("/");

			expect(result.paramKeys).toEqual([]);
			expect(result.pattern).toBe(String.raw`()\/`);
			expect(result.restKeys).toBeUndefined();
		});

		test("should compile a regex that matches only '/'", () => {
			const { regex } = compile("/");

			expect(regex.test("/")).toBe(true);
			expect(regex.test("")).toBe(false);
			expect(regex.test("/a")).toBe(false);
		});
	});

	describe("empty path ''", () => {
		test("should produce the seed-only pattern", () => {
			const { paramKeys, pattern, restKeys } = pathToRegexp("");

			expect(paramKeys).toEqual([]);
			expect(pattern).toBe("()");
			expect(restKeys).toBeUndefined();
		});

		test("should compile a regex that matches only the empty string", () => {
			const { regex } = compile("");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(false);
			expect(regex.test("/a")).toBe(false);
		});
	});

	describe("literal segments", () => {
		test("should compile a single literal segment", () => {
			const { paramKeys, regex, restKeys } = compile("/users");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/users")).toBe(true);
			expect(regex.test("/user")).toBe(false);
			expect(regex.test("/users/1")).toBe(false);
		});

		test("should compile multiple literal segments", () => {
			const { regex } = compile("/api/v1/health");

			expect(regex.test("/api/v1/health")).toBe(true);
			expect(regex.test("/api/v1")).toBe(false);
			expect(regex.test("/api/v1/health/extra")).toBe(false);
		});

		test("should normalize a path without a leading '/' the same as one with it", () => {
			const withSlash = pathToRegexp("/users/:id");
			const withoutSlash = pathToRegexp("users/:id");

			expect(withoutSlash.pattern).toBe(withSlash.pattern);
			expect(withoutSlash.paramKeys).toEqual(withSlash.paramKeys);

			const { regex } = compile("users/:id");

			expect("/users/1".match(regex)![2]).toBe("1");
		});

		test("should ignore extra consecutive slashes between segments", () => {
			const { regex } = compile("//users");

			expect(regex.test("/users")).toBe(true);
		});

		test("should ignore a trailing slash", () => {
			const { regex } = compile("/users/");

			expect(regex.test("/users")).toBe(true);
		});

		test("should escape regex-special characters in literal segments", () => {
			const { regex } = compile("/a.b");

			expect(regex.test("/a.b")).toBe(true);
			expect(regex.test("/aXb")).toBe(false);
		});

		test("should escape additional regex-special characters in literals", () => {
			const symbols = ["(", ")", "[", "]", "{", "}", "^", "+", "|", "$"];

			for (let i = 0; i < symbols.length; i++) {
				const path = `/a${symbols[i]}b`;

				const { regex } = compile(path);

				expect(regex.test(path)).toBe(true);
			}
		});

		test("should not treat '+' in a literal as regex repetition", () => {
			const { regex } = compile("/a+b");

			expect(regex.test("/a+b")).toBe(true);
			expect(regex.test("/aaab")).toBe(false);
			expect(regex.test("/ab")).toBe(false);
		});

		test("should make an optional literal segment optional in the regex", () => {
			const { regex } = compile("/users/details?");

			expect(regex.test("/users/details")).toBe(true);
			expect(regex.test("/users")).toBe(true);
		});

		test("should make the trailing slash optional with a trailing '/?'", () => {
			const { regex } = compile("/foo/?");

			expect(regex.test("/foo")).toBe(true);
			expect(regex.test("/foo/")).toBe(true);
			expect(regex.test("/foo/bar")).toBe(false);
		});

		test("should compile a lone '?' segment to an optional empty literal", () => {
			const { paramKeys, pattern, regex, restKeys } = compile("/?");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(pattern).toBe(String.raw`()(?:\/)?`);
			expect(regex.test("")).toBe(true);
			expect(regex.test("/")).toBe(true);
			expect(regex.test("/a")).toBe(false);
		});

		test("should treat a single leading '.' as a literal (not a rest param)", () => {
			const { paramKeys, regex, restKeys } = compile("/.well-known");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/.well-known")).toBe(true);
		});

		test("should treat two leading '..' (not three) as a literal", () => {
			const { paramKeys, regex, restKeys } = compile("/..relative");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/..relative")).toBe(true);
		});

		test("should treat '*' followed by more characters as a literal", () => {
			const { paramKeys, regex, restKeys } = compile("/*x");

			expect(paramKeys).toEqual([]);
			expect(restKeys).toBeUndefined();
			expect(regex.test("/*x")).toBe(true);
			expect(regex.test("/anything")).toBe(false);
		});
	});

	describe(":name required parameter", () => {
		describe("with path '/users/:id'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/users/:id");
			});

			test("should capture the required param value", () => {
				expect(compiled.paramKeys).toEqual(["id"]);
				expect(compiled.restKeys).toBeUndefined();

				const match = "/users/1".match(compiled.regex);

				expect(match).not.toBeNull();
				expect(match![2]).toBe("1");
			});

			test("should not match without the required param value", () => {
				expect(compiled.regex.test("/users")).toBe(false);
				expect(compiled.regex.test("/users/")).toBe(false);
			});

			test("should reject values containing forbidden characters (/, whitespace, ?, #)", () => {
				expect(compiled.regex.test("/users/0 1")).toBe(false);
				expect(compiled.regex.test("/users/0?1")).toBe(false);
				expect(compiled.regex.test("/users/0#1")).toBe(false);
				expect(compiled.regex.test("/users/a/b")).toBe(false);
			});
		});

		test("should capture multiple named params in order", () => {
			const { paramKeys, regex } = compile("/users/:user/posts/:post");

			expect(paramKeys).toEqual(["user", "post"]);

			const match = "/users/abc/posts/1".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("abc");
			expect(match![3]).toBe("1");
		});

		test("should support a ':' segment with no name (empty key)", () => {
			const { paramKeys } = compile("/:");

			expect(paramKeys).toEqual([""]);
		});

		test("should support a ':' segment with empty name at a non-root position", () => {
			const { paramKeys, regex } = compile("/foo/:");

			expect(paramKeys).toEqual([""]);
			expect(regex.test("/foo/anything")).toBe(true);
			expect("/foo/value".match(regex)![2]).toBe("value");
		});
	});

	describe(":name? optional parameter", () => {
		test("should match both with and without the param", () => {
			const { paramKeys, regex, restKeys } = compile("/posts/:slug?");

			expect(paramKeys).toEqual(["slug"]);
			expect(restKeys).toBeUndefined();

			expect(regex.test("/posts")).toBe(true);
			expect(regex.test("/posts/hello")).toBe(true);

			const match = "/posts/hello".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("hello");

			const missing = "/posts".match(regex);

			expect(missing).not.toBeNull();
			expect(missing![2]).toBeUndefined();
		});

		test("should support an optional :name? at the root", () => {
			const { regex } = compile("/:id?");

			expect(regex.test("")).toBe(true);
			expect(regex.test("/abc")).toBe(true);
		});
	});

	describe("...name rest parameter", () => {
		describe("with path '/files/...path'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/files/...path");
			});

			test("should capture one or more remaining segments", () => {
				expect(compiled.paramKeys).toEqual(["path"]);
				expect(compiled.restKeys).toEqual(["path"]);

				expect("/files/a".match(compiled.regex)![2]).toBe("a");
				expect("/files/a/b/c".match(compiled.regex)![2]).toBe("a/b/c");
			});

			test("should require at least one segment after the prefix", () => {
				expect(compiled.regex.test("/files")).toBe(false);
				expect(compiled.regex.test("/files/")).toBe(false);
			});

			test("should reject forbidden characters in rest segments", () => {
				expect(compiled.regex.test("/files/a b")).toBe(false);
				expect(compiled.regex.test("/files/a?b")).toBe(false);
				expect(compiled.regex.test("/files/a#b")).toBe(false);
			});
		});

		test("should backtrack correctly when followed by literal segments", () => {
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

		test("should collect every rest param key when multiple rest are present", () => {
			const { paramKeys, restKeys } = compile("/...a/middle/...b");

			expect(paramKeys).toEqual(["a", "b"]);
			expect(restKeys).toEqual(["a", "b"]);
		});

		test("should support an empty rest name", () => {
			const { paramKeys, restKeys } = compile("/...");

			expect(paramKeys).toEqual([""]);
			expect(restKeys).toEqual([""]);
		});

		test("should treat more than three leading dots as part of the rest name", () => {
			const { paramKeys, restKeys } = compile("/....name");

			expect(paramKeys).toEqual([".name"]);
			expect(restKeys).toEqual([".name"]);
		});
	});

	describe("...name? optional rest parameter", () => {
		test("should match with and without trailing segments", () => {
			const { paramKeys, regex, restKeys } = compile("/files/...path?");

			expect(paramKeys).toEqual(["path"]);
			expect(restKeys).toEqual(["path"]);

			expect(regex.test("/files")).toBe(true);
			expect(regex.test("/files/a/b")).toBe(true);

			const match = "/files/a/b".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("a/b");

			const missing = "/files".match(regex);

			expect(missing).not.toBeNull();
			expect(missing![2]).toBeUndefined();
		});

		test("should support an optional rest with no name", () => {
			const { paramKeys, regex, restKeys } = compile("/...?");

			expect(paramKeys).toEqual([""]);
			expect(restKeys).toEqual([""]);

			expect(regex.test("")).toBe(true);
			expect(regex.test("/a")).toBe(true);
			expect(regex.test("/a/b/c")).toBe(true);

			const match = "/a/b/c".match(regex);

			expect(match).not.toBeNull();
			expect(match![2]).toBe("a/b/c");

			const missing = "".match(regex);

			expect(missing).not.toBeNull();
			expect(missing![2]).toBeUndefined();
		});
	});

	describe("* wildcard segment", () => {
		describe("with path '/static/*'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/static/*");
			});

			test("should match one or more segments without capturing", () => {
				expect(compiled.paramKeys).toEqual([]);
				expect(compiled.restKeys).toBeUndefined();

				expect(compiled.regex.test("/static/a")).toBe(true);
				expect(compiled.regex.test("/static/a/b/c")).toBe(true);
			});

			test("should reject when the wildcard segment is absent", () => {
				expect(compiled.regex.test("/static")).toBe(false);
			});

			test("should not add extra capture groups", () => {
				const match = "/static/a/b".match(compiled.regex);

				expect(compiled.paramKeys).toEqual([]);
				expect(match!.length).toBe(2);
			});
		});
	});

	describe("*? optional wildcard", () => {
		describe("with path '/static/*?'", () => {
			let compiled: ReturnType<typeof compile>;

			beforeAll(() => {
				compiled = compile("/static/*?");
			});

			test("should match with and without the wildcard tail", () => {
				expect(compiled.paramKeys).toEqual([]);
				expect(compiled.restKeys).toBeUndefined();

				expect(compiled.regex.test("/static")).toBe(true);
				expect(compiled.regex.test("/static/a/b")).toBe(true);
			});

			test("should not add extra capture groups whether the tail is present or absent", () => {
				expect(compiled.paramKeys).toEqual([]);
				expect("/static/a/b".match(compiled.regex)!.length).toBe(2);
				expect("/static".match(compiled.regex)!.length).toBe(2);
			});
		});
	});

	describe("mixed segment types", () => {
		test("should support literals, named params and rest combined", () => {
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

		test("should support optional named params alongside required ones", () => {
			const { paramKeys, regex } = compile("/users/:user/:tab?");

			expect(paramKeys).toEqual(["user", "tab"]);
			expect(regex.test("/users/abc")).toBe(true);
			expect(regex.test("/users/abc/settings")).toBe(true);
			expect("/users/abc/settings".match(regex)![3]).toBe("settings");
		});

		test("should preserve left-to-right paramKeys order across mixed segments", () => {
			const { paramKeys } = compile(
				"/:first/middle/:second/...rest/:fourth",
			);

			expect(paramKeys).toEqual(["first", "second", "rest", "fourth"]);
		});

		test("should append exactly 1 + paramKeys.length capture groups", () => {
			const { paramKeys, regex } = compile("/a/:b/:c");
			const match = "/a/foo/bar".match(regex);

			expect(match).not.toBeNull();
			expect(paramKeys).toHaveLength(2);
			expect(match!.length).toBe(1 + 1 + paramKeys.length);
			expect(match![1]).toBe("");
			expect(match![2]).toBe("foo");
			expect(match![3]).toBe("bar");
		});
	});
});
