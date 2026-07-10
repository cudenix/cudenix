import { beforeAll, describe, expect, it } from "bun:test";

import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexps/path-to-regexp";
import { parseParams } from "@/utils/urls/parse-params";

const exec = (pattern: string, url: string) => {
	const match = new RegExp(`^${pattern}$`).exec(url);

	if (!match) {
		throw new Error(`pattern "${pattern}" did not match "${url}"`);
	}

	return match;
};

describe("parseParams", () => {
	describe("typical matches", () => {
		describe("with a single parameter", () => {
			let result: ReturnType<typeof parseParams>;

			beforeAll(() => {
				result = parseParams(
					exec("()/a/([^/]+)", "/a/v1"),
					["p1"],
					1,
					[],
				);
			});

			it("should capture the parameter value", () => {
				expect(result.p1).toBe("v1");
			});

			it("should expose only the parsed parameter key", () => {
				expect(Object.keys(result)).toEqual(["p1"]);
			});
		});

		describe("with two parameters", () => {
			let result: ReturnType<typeof parseParams>;

			beforeAll(() => {
				result = parseParams(
					exec("()/a/([^/]+)/([^/]+)", "/a/v1/v2"),
					["p1", "p2"],
					1,
					[],
				);
			});

			it("should capture the first parameter value", () => {
				expect(result.p1).toBe("v1");
			});

			it("should capture the second parameter value", () => {
				expect(result.p2).toBe("v2");
			});

			it("should preserve declaration order of the parameter names", () => {
				expect(Object.keys(result)).toEqual(["p1", "p2"]);
			});
		});
	});

	describe("value decoding", () => {
		it("should decode '%xx' escapes in a value", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1%20v2"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v1 v2");
		});

		it("should take a value with no '%' verbatim, leaving '+' untouched", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1+v2"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v1+v2");
		});

		it("should preserve non-ASCII characters", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/☕"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("☕");
		});

		it("should decode a percent-encoded slash inside a normal parameter", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1%2Fv2"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v1/v2");
		});

		it("should reassemble a percent-encoded surrogate pair when decoding", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/%F0%9F%98%80"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("😀");
		});

		it("should keep a value with a malformed '%' escape verbatim instead of throwing", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/100%"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("100%");
		});

		it("should keep a value with a non-hex '%' escape verbatim", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/%zz"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("%zz");
		});
	});

	describe("rest parameters", () => {
		it("should split a multi-segment rest value on '/'", () => {
			const result = parseParams(exec("()/a/(.+)", "/a/b/c"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual(["b", "c"]);
		});

		it("should wrap a single-segment rest value in an array", () => {
			const result = parseParams(exec("()/a/(.+)", "/a/b"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual(["b"]);
		});

		it("should decode a rest value before splitting it", () => {
			const result = parseParams(
				exec("()/a/(.+)", "/a/b%20c/d"),
				["r1"],
				1,
				["r1"],
			);

			expect(result.r1).toEqual(["b c", "d"]);
		});

		it("should treat a decoded '%2F' as a split point", () => {
			const result = parseParams(
				exec("()/a/(.+)", "/a/b%2Fc"),
				["r1"],
				1,
				["r1"],
			);

			expect(result.r1).toEqual(["b", "c"]);
		});

		it("should keep a double-encoded '/' inside one segment after a single decode", () => {
			const result = parseParams(
				exec("()/a/(.+)", "/a/b%252Fc"),
				["r1"],
				1,
				["r1"],
			);

			expect(result.r1).toEqual(["b%2Fc"]);
		});

		it("should keep a rest value with a malformed '%' escape verbatim and still split it", () => {
			const result = parseParams(
				exec("()/a/(.+)", "/a/100%/b"),
				["r1"],
				1,
				["r1"],
			);

			expect(result.r1).toEqual(["100%", "b"]);
		});

		it("should keep a normal parameter alongside a rest parameter", () => {
			const result = parseParams(
				exec("()/a/([^/]+)/(.+)", "/a/v1/b/c"),
				["p1", "r1"],
				1,
				["r1"],
			);

			expect(result.p1).toBe("v1");
			expect(result.r1).toEqual(["b", "c"]);
		});

		it("should yield a single empty segment for an empty rest capture", () => {
			const result = parseParams(exec("()/a/(.*)", "/a/"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual([""]);
		});

		it("should keep a trailing empty segment from a trailing slash", () => {
			const result = parseParams(exec("()/a/(.+)", "/a/b/"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual(["b", ""]);
		});
	});

	describe("matchOffset handling", () => {
		it("should read captures starting after the leading empty group", () => {
			const result = parseParams(
				exec("()()/a/([^/]+)", "/a/v1"),
				["p1"],
				2,
				[],
			);

			expect(result.p1).toBe("v1");
		});

		it("should read each parameter at its offset-relative slot", () => {
			const result = parseParams(
				exec("()/a/([^/]+)/b/([^/]+)", "/a/v1/b/v2"),
				["p1", "p2"],
				1,
				[],
			);

			expect(result).toEqual({ p1: "v1", p2: "v2" });
		});
	});

	describe("duplicate parameter names", () => {
		it("should let a later duplicate parameter name overwrite the earlier value", () => {
			const result = parseParams(
				exec("()/a/([^/]+)/([^/]+)", "/a/v1/v2"),
				["p1", "p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v2");
			expect(Object.keys(result)).toEqual(["p1"]);
		});
	});

	describe("unmatched optional captures", () => {
		it("should skip a parameter whose capture is undefined", () => {
			const result = parseParams(
				exec("()/a(?:/([^/]+))?", "/a"),
				["p1"],
				1,
				[],
			);

			expect("p1" in result).toBe(false);
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should keep matched parameters when a later one is undefined", () => {
			const result = parseParams(
				exec("()/a/([^/]+)(?:/([^/]+))?", "/a/v1"),
				["p1", "p2"],
				1,
				[],
			);

			expect(result.p1).toBe("v1");
			expect("p2" in result).toBe(false);
		});

		it("should skip a rest parameter whose capture is undefined", () => {
			const result = parseParams(
				exec("()/a(?:/(.+))?", "/a"),
				["r1"],
				1,
				["r1"],
			);

			expect("r1" in result).toBe(false);
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should keep an empty capture as an empty-string value for a normal parameter", () => {
			const result = parseParams(exec("()/a/(.*)", "/a/"), ["p1"], 1, []);

			expect(Object.hasOwn(result, "p1")).toBe(true);
			expect(result.p1).toBe("");
		});

		it("should skip a slot whose parameter name is undefined (sparse keys)", () => {
			const paramKeys: string[] = [];

			paramKeys[1] = "p2";

			const result = parseParams(
				exec("()/a/([^/]+)/([^/]+)", "/a/v1/v2"),
				paramKeys,
				1,
				[],
			);

			expect(Object.keys(result)).toEqual(["p2"]);
			expect(result.p2).toBe("v2");
		});
	});

	describe("dangerous key names", () => {
		it("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1"),
				["__proto__"],
				1,
				[],
			);

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(result)),
			).toBeNull();
		});

		it("should store `constructor` as a real own key without invoking inheritance", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1"),
				["constructor"],
				1,
				[],
			);

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Reflect.get(result, "constructor")).toBe("v1");
		});
	});

	describe("empty / nothing to read", () => {
		it("should return an empty dictionary when there is no match", () => {
			const result = parseParams(undefined, ["p1"], 1, []);

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("should return an empty dictionary when there are no parameter keys", () => {
			const result = parseParams(exec("()/a", "/a"), [], 1, []);

			expect(Object.keys(result)).toHaveLength(0);
		});
	});

	describe("return shape", () => {
		describe("with a single parameter", () => {
			let result: ReturnType<typeof parseParams>;

			beforeAll(() => {
				result = parseParams(
					exec("()/a/([^/]+)", "/a/v1"),
					["p1"],
					1,
					[],
				);
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
			const a = parseParams(exec("()/a/([^/]+)", "/a/v1"), ["p1"], 1, []);
			const b = parseParams(exec("()/a/([^/]+)", "/a/v1"), ["p1"], 1, []);

			expect(a).not.toBe(b);
		});
	});

	describe("integration with pathToRegexp", () => {
		it("should read params from a standalone compiled pattern at matchOffset 1", () => {
			const { paramKeys, pattern, restKeys } =
				pathToRegexp("/a/:p1/b/...r1");
			const match = exec(pattern, "/a/v1/b/v2/v3");

			expect(parseParams(match, paramKeys, 1, restKeys)).toEqual({
				p1: "v1",
				r1: ["v2", "v3"],
			});
		});

		it("should read params from a merged alternation using the per-route match offset", () => {
			const first = pathToRegexp("/x");
			const second = pathToRegexp("/a/:p1/b/:p2");
			const regexp = new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${first.pattern}|${second.pattern})(?![^?#])`,
			);

			const firstOffset = 3;
			const secondOffset = firstOffset + 1 + first.paramKeys.length;

			const match = regexp.exec("http://a.b/a/v1/b/v2") ?? undefined;

			expect(match?.[firstOffset]).toBeUndefined();
			expect(match?.[secondOffset]).toBe("");
			expect(
				parseParams(
					match,
					second.paramKeys,
					secondOffset,
					second.restKeys,
				),
			).toEqual({ p1: "v1", p2: "v2" });
		});
	});
});
