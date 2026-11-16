import { describe, expect, it } from "bun:test";

import { pathToRegexp } from "@/utils/regexps/path-to-regexp";

const PARAM = String.raw`\/([^/\s?#]+)`;

const REST = String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))`;

const TERMINAL_WILDCARD = String.raw`\/[^\s?#]*`;

const WILDCARD = String.raw`\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?`;

const compile = (path: string): RegExp =>
	new RegExp(`^${pathToRegexp(path).pattern}$`, "u");

describe("pathToRegexp", () => {
	describe("output", () => {
		it.each<
			[
				path: string,
				pattern: string,
				paramKeys: string[],
				paramFlags: number[],
				ranks: number[],
				restKeys: string[],
			]
		>([
			["/", String.raw`\/()`, [], [], [], []],
			["", "()", [], [], [], []],
			["//", String.raw`\/()`, [], [], [], []],
			["\\", String.raw`\/()`, [], [], [], []],
			["a/b", String.raw`\/a\/b()`, [], [], [0, 0], []],
			["//a//b//", String.raw`\/a\/b()`, [], [], [0, 0], []],
			[String.raw`\a\b`, String.raw`\/a\/b()`, [], [], [0, 0], []],
			["/:p1", `${PARAM}()`, ["p1"], [0], [1], []],
			[
				"/a/:p1?",
				String.raw`\/a(?:${PARAM})?()`,
				["p1"],
				[1],
				[0, 1],
				[],
			],
			["/...r1", `${REST}()`, ["r1"], [2], [3], ["r1"]],
			[
				"/a/...r1?",
				String.raw`\/a(?:${REST})?()`,
				["r1"],
				[3],
				[0, 3],
				["r1"],
			],
			["/..a", String.raw`\/\.\.a()`, [], [], [0], []],
			["/a/*", String.raw`\/a${TERMINAL_WILDCARD}()`, [], [], [0, 4], []],
			[
				"/a/*/",
				String.raw`\/a${TERMINAL_WILDCARD}()`,
				[],
				[],
				[0, 4],
				[],
			],
			[
				"/a/*?",
				String.raw`\/a(?:${TERMINAL_WILDCARD})?()`,
				[],
				[],
				[0, 4],
				[],
			],
			["/a/*/b", String.raw`\/a${WILDCARD}\/b()`, [], [], [0, 2, 0], []],
			["/*a", String.raw`\/\*a()`, [], [], [0], []],
			["/a/b?", String.raw`\/a(?:\/b)?()`, [], [], [0, 0], []],
			[
				"/a?/:p1?",
				String.raw`(?:(?:\/a)?(?:${PARAM})?|\/)()`,
				["p1"],
				[1],
				[0, 1],
				[],
			],
			[
				"/a/:p1/*/...r1",
				String.raw`\/a${PARAM}${WILDCARD}${REST}()`,
				["p1", "r1"],
				[0, 2],
				[0, 1, 2, 3],
				["r1"],
			],
		])(
			"should compile %j",
			(path, pattern, paramKeys, paramFlags, ranks, restKeys) => {
				expect(pathToRegexp(path)).toEqual({
					paramFlags,
					paramKeys,
					pattern,
					ranks,
					restKeys,
				});
			},
		);
	});

	describe("static segments", () => {
		it.each([
			["/a$()*+.[]|", String.raw`\/a\$\(\)\*\+\.\[\]\|()`],
			['/a"#<>?^`{}b', String.raw`\/a%22%23%3C%3E%3F%5E%60%7B%7Db()`],
			["/a b\t\u007F", String.raw`\/a%20b%09%7F()`],
			["/!%&',-09:;=@AZ_az~", String.raw`\/!%&',-09:;=@AZ_az~()`],
			["/café", String.raw`\/caf%C3%A9()`],
			["/😀", String.raw`\/%F0%9F%98%80()`],
			["/a\uD800", String.raw`\/a%EF%BF%BD()`],
		])("should compile %j to %j", (path, pattern) => {
			expect(pathToRegexp(path).pattern).toBe(pattern);
		});

		it.each([
			"/a$()*+.[]|",
			"/!%&',-09:;=@AZ_az~",
			"/café",
			"/😀",
			"/a\uD800",
		])("should match the pathname the url parser builds for %j", (path) => {
			expect(
				compile(path).test(new URL(`http://localhost${path}`).pathname),
			).toBe(true);
		});
	});

	describe("matching", () => {
		it.each<[string, string, (string | undefined)[]]>([
			["/", "/", []],
			["", "", []],
			["/a.b", "/a.b", []],
			["/a/:p1", "/a/v1", ["v1"]],
			["/a/:p1?", "/a", [undefined]],
			["/a/:p1?", "/a/v1", ["v1"]],
			["/a/:p1/b/:p2", "/a/v1/b/v2", ["v1", "v2"]],
			["/a/...r1", "/a/v1/v2/v3", ["v1/v2/v3"]],
			["/a/...r1?", "/a", [undefined]],
			["/...r1/a", "/v1/v2/a", ["v1/v2"]],
			["/a/*", "/a/", []],
			["/a/*", "/a/v1//v2/", []],
			["/a/*?", "/a", []],
			["/a/*/b", "/a/v1/v2/b", []],
			["/:p1/*/...r1", "/v1/v2/v3/v4", ["v1", "v4"]],
			["/a/b?", "/a", []],
			["/a/b?", "/a/b", []],
			["/:p1?", "", [undefined]],
			["/:p1?", "/", [undefined]],
			["/:p1?", "/v1", ["v1"]],
		])(
			"should compile %j so that %j captures %j",
			(path, input, captures) => {
				const match = compile(path).exec(input);

				expect<(string | undefined)[] | undefined>(
					match?.slice(1, -1),
				).toEqual(captures);
				expect(match?.at(-1)).toBe("");
			},
		);

		it.each([
			["/", "/a"],
			["", "/"],
			["/a.b", "/aXb"],
			["/a/:p1", "/a"],
			["/a/:p1", "/a/"],
			["/a/:p1", "/a/v1/v2"],
			["/a/:p1", "/a/v1 v2"],
			["/a/:p1", "/a/v1?v2"],
			["/a/:p1", "/a/v1#v2"],
			["/a/...r1", "/a"],
			["/a/...r1", "/a/v1/"],
			["/a/...r1", "/a/v1?v2"],
			["/a/*", "/a"],
			["/a/*", "/a/v1?v2"],
			["/a/*/b", "/a//v1/b"],
			["/:p1?", "/v1/v2"],
		])("should compile %j so that it rejects %j", (path, input) => {
			expect(compile(path).test(input)).toBe(false);
		});
	});
});
