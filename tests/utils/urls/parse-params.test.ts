import { beforeAll, describe, expect, test } from "bun:test";

import { Empty } from "@/utils/objects/empty";
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

			test("should capture the parameter value", () => {
				expect(result.p1).toBe("v1");
			});

			test("should expose only the parsed parameter key", () => {
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

			test("should capture the first parameter value", () => {
				expect(result.p1).toBe("v1");
			});

			test("should capture the second parameter value", () => {
				expect(result.p2).toBe("v2");
			});

			test("should preserve declaration order of the parameter names", () => {
				expect(Object.keys(result)).toEqual(["p1", "p2"]);
			});
		});
	});

	describe("value decoding", () => {
		test("should decode '%xx' escapes in a value", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1%20v2"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v1 v2");
		});

		test("should take a value with no '%' verbatim, leaving '+' untouched", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1+v2"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v1+v2");
		});

		test("should preserve non-ASCII characters", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/☕"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("☕");
		});

		test("should decode a percent-encoded slash inside a normal parameter", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1%2Fv2"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("v1/v2");
		});

		test("should reassemble a percent-encoded surrogate pair when decoding", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/%F0%9F%98%80"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("😀");
		});

		test("should keep a value with a malformed '%' escape verbatim instead of throwing", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/100%"),
				["p1"],
				1,
				[],
			);

			expect(result.p1).toBe("100%");
		});

		test("should keep a value with a non-hex '%' escape verbatim", () => {
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
		test("should split a multi-segment rest value on '/'", () => {
			const result = parseParams(exec("()/a/(.+)", "/a/b/c"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual(["b", "c"]);
		});

		test("should wrap a single-segment rest value in an array", () => {
			const result = parseParams(exec("()/a/(.+)", "/a/b"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual(["b"]);
		});

		test("should decode a rest value before splitting it", () => {
			const result = parseParams(
				exec("()/a/(.+)", "/a/b%20c/d"),
				["r1"],
				1,
				["r1"],
			);

			expect(result.r1).toEqual(["b c", "d"]);
		});

		test("should treat a decoded '%2F' as a split point", () => {
			const result = parseParams(
				exec("()/a/(.+)", "/a/b%2Fc"),
				["r1"],
				1,
				["r1"],
			);

			expect(result.r1).toEqual(["b", "c"]);
		});

		test("should keep a normal parameter alongside a rest parameter", () => {
			const result = parseParams(
				exec("()/a/([^/]+)/(.+)", "/a/v1/b/c"),
				["p1", "r1"],
				1,
				["r1"],
			);

			expect(result.p1).toBe("v1");
			expect(result.r1).toEqual(["b", "c"]);
		});

		test("should yield a single empty segment for an empty rest capture", () => {
			const result = parseParams(exec("()/a/(.*)", "/a/"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual([""]);
		});

		test("should keep a trailing empty segment from a trailing slash", () => {
			const result = parseParams(exec("()/a/(.+)", "/a/b/"), ["r1"], 1, [
				"r1",
			]);

			expect(result.r1).toEqual(["b", ""]);
		});
	});

	describe("matchOffset handling", () => {
		test("should read captures starting after the leading empty group", () => {
			const result = parseParams(
				exec("()()/a/([^/]+)", "/a/v1"),
				["p1"],
				2,
				[],
			);

			expect(result.p1).toBe("v1");
		});

		test("should read each parameter at its offset-relative slot", () => {
			const result = parseParams(
				exec("()/a/([^/]+)/b/([^/]+)", "/a/v1/b/v2"),
				["p1", "p2"],
				1,
				[],
			);

			expect(result).toEqual({ p1: "v1", p2: "v2" });
		});
	});

	describe("unmatched optional captures", () => {
		test("should skip a parameter whose capture is undefined", () => {
			const result = parseParams(
				exec("()/a(?:/([^/]+))?", "/a"),
				["p1"],
				1,
				[],
			);

			expect("p1" in result).toBe(false);
			expect(Object.keys(result)).toHaveLength(0);
		});

		test("should keep matched parameters when a later one is undefined", () => {
			const result = parseParams(
				exec("()/a/([^/]+)(?:/([^/]+))?", "/a/v1"),
				["p1", "p2"],
				1,
				[],
			);

			expect(result.p1).toBe("v1");
			expect("p2" in result).toBe(false);
		});

		test("should skip a rest parameter whose capture is undefined", () => {
			const result = parseParams(
				exec("()/a(?:/(.+))?", "/a"),
				["r1"],
				1,
				["r1"],
			);

			expect("r1" in result).toBe(false);
			expect(Object.keys(result)).toHaveLength(0);
		});
	});

	describe("dangerous key names", () => {
		test("should store `__proto__` as a real own key without polluting the prototype", () => {
			const result = parseParams(
				exec("()/a/([^/]+)", "/a/v1"),
				["__proto__"],
				1,
				[],
			);

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("v1");
			expect(({} as Record<string, unknown>).__proto__).not.toBe("v1");
		});

		test("should store `constructor` as a real own key without invoking inheritance", () => {
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
		test("should return an empty dictionary when there is no match", () => {
			const result = parseParams(undefined, ["p1"], 1, []);

			expect(result).toBeInstanceOf(Empty);
			expect(Object.keys(result)).toHaveLength(0);
		});

		test("should return an empty dictionary when there are no parameter keys", () => {
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

			test("should return a dictionary inheriting from Empty", () => {
				expect(result).toBeInstanceOf(Empty);
			});

			test("should have a null prototype root (no Object.prototype methods)", () => {
				expect(
					Object.getPrototypeOf(Object.getPrototypeOf(result)),
				).toBeNull();
				expect("toString" in result).toBe(false);
				expect("hasOwnProperty" in result).toBe(false);
			});
		});

		test("should return a fresh dictionary on each call", () => {
			const a = parseParams(exec("()/a/([^/]+)", "/a/v1"), ["p1"], 1, []);
			const b = parseParams(exec("()/a/([^/]+)", "/a/v1"), ["p1"], 1, []);

			expect(a).not.toBe(b);
		});
	});
});
