import { describe, expect, expectTypeOf, it } from "bun:test";

import { PARAM_FLAG_REST, pathToRegexp } from "@/utils/regexps/path-to-regexp";
import type { ExtractUrlParams } from "@/utils/types/extract-url-params";
import { decodePathParam } from "@/utils/urls/decode-path-param";

describe("ExtractUrlParams", () => {
	describe("root path '/'", () => {
		it("should resolve to an empty record", () => {
			expectTypeOf<ExtractUrlParams<"/">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe("empty path ''", () => {
		it("should resolve to an empty record", () => {
			expectTypeOf<ExtractUrlParams<"">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe("literal segments", () => {
		it("should resolve to an empty record for a single literal segment", () => {
			expectTypeOf<ExtractUrlParams<"/a">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should resolve to an empty record for a deeply nested literal path", () => {
			expectTypeOf<ExtractUrlParams<"/a/b/c/d">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should resolve to an empty record for a multi-segment literal path", () => {
			expectTypeOf<ExtractUrlParams<"/a/b/c">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe(":name required parameter", () => {
		it("should resolve a single ':name' segment to a `string` value", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});

		it("should capture multiple required params in declaration order", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/:p2">
			>().branded.toEqualTypeOf<{ p1: string; p2: string }>();
		});

		it("should capture two consecutive required params", () => {
			expectTypeOf<ExtractUrlParams<"/:p1/:p2">>().branded.toEqualTypeOf<{
				p1: string;
				p2: string;
			}>();
		});

		it("should capture a required param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":p1">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});

		it("should capture a required param when the path has no leading slash", () => {
			expectTypeOf<ExtractUrlParams<"a/:p1">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});

		it("should capture a required param when the path has a trailing slash", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1/">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});
	});

	describe(":name? optional parameter", () => {
		it("should resolve a ':name?' segment to a `string | undefined` value", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1?">>().branded.toEqualTypeOf<{
				p1: string | undefined;
			}>();
		});

		it("should capture an optional param in the middle of a path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1?/b">
			>().branded.toEqualTypeOf<{ p1: string | undefined }>();
		});

		it("should capture an optional param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":p1?">>().branded.toEqualTypeOf<{
				p1: string | undefined;
			}>();
		});

		it("should accumulate two consecutive optional params", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1?/:p2?">
			>().branded.toEqualTypeOf<{
				p1: string | undefined;
				p2: string | undefined;
			}>();
		});
	});

	describe("...name rest parameter", () => {
		it("should resolve a '...name' segment to a `string[]` value", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1">>().branded.toEqualTypeOf<{
				r1: string[];
			}>();
		});

		it("should capture a required rest followed by a literal segment", () => {
			expectTypeOf<ExtractUrlParams<"/...r1/a">>().branded.toEqualTypeOf<{
				r1: string[];
			}>();
		});

		it("should keep capturing a named param that follows a rest segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/...r1/:p1">
			>().branded.toEqualTypeOf<{ r1: string[]; p1: string }>();
		});

		it("should capture a required rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...r1">>().branded.toEqualTypeOf<{
				r1: string[];
			}>();
		});

		it("should collect every rest param key when multiple are present", () => {
			expectTypeOf<
				ExtractUrlParams<"/...r1/a/...r2">
			>().branded.toEqualTypeOf<{ r1: string[]; r2: string[] }>();
		});

		it("should guard the rest element type against an `any[]` regression that branded equality cannot see", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1">["r1"]>().toEqualTypeOf<
				string[]
			>();
		});
	});

	describe("...name? optional rest parameter", () => {
		it("should resolve a '...name?' segment to a `string[] | undefined` value", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1?">
			>().branded.toEqualTypeOf<{ r1: string[] | undefined }>();
		});

		it("should capture an optional rest followed by a literal segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1?/b">
			>().branded.toEqualTypeOf<{ r1: string[] | undefined }>();
		});

		it("should capture an optional rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...r1?">>().branded.toEqualTypeOf<{
				r1: string[] | undefined;
			}>();
		});

		it("should guard the optional rest element type against an `any[]` regression that branded equality cannot see", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1?">["r1"]>().toEqualTypeOf<
				string[] | undefined
			>();
		});
	});

	describe("mixed segment types", () => {
		it("should accumulate a required param immediately followed by a rest", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/...r1">
			>().branded.toEqualTypeOf<{ p1: string; r1: string[] }>();
		});

		it("should accumulate required and optional named params", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/:p2?">
			>().branded.toEqualTypeOf<{ p1: string; p2: string | undefined }>();
		});

		it("should accumulate required and rest params separated by literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">
			>().branded.toEqualTypeOf<{ p1: string; r1: string[] }>();
		});

		it("should accumulate every param kind in a single path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/:p2?/c/...r1">
			>().branded.toEqualTypeOf<{
				p1: string;
				p2: string | undefined;
				r1: string[];
			}>();
		});

		it("should accumulate an optional param and a rest separated by literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1?/b/...r1">
			>().branded.toEqualTypeOf<{
				p1: string | undefined;
				r1: string[];
			}>();
		});

		it("should guard both named and rest value types against an `any[]` regression that branded equality cannot see", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">["p1"]
			>().toEqualTypeOf<string>();
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">["r1"]
			>().toEqualTypeOf<string[]>();
		});
	});

	describe("wildcard segments", () => {
		it("should contribute no entry for a non-capturing '*' wildcard", () => {
			expectTypeOf<ExtractUrlParams<"/a/*">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe("union distribution", () => {
		it("should distribute over a union of route literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1" | "/b/:p2">
			>().branded.toEqualTypeOf<{ p1: string } | { p2: string }>();
		});

		it("should distribute over a union mixing a param route and a literal-only route", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1" | "/a/b">
			>().branded.toEqualTypeOf<{ p1: string } | NonNullable<unknown>>();
		});
	});

	describe("empty parameter names", () => {
		it("should resolve a bare ':' segment to an empty-key string value", () => {
			expectTypeOf<ExtractUrlParams<"/:">>().branded.toEqualTypeOf<{
				"": string;
			}>();
		});

		it("should resolve a bare '...' segment to an empty-key string[] value", () => {
			expectTypeOf<ExtractUrlParams<"/...">>().branded.toEqualTypeOf<{
				"": string[];
			}>();
		});

		it("should resolve a bare ':?' segment to an empty-key optional value", () => {
			expectTypeOf<ExtractUrlParams<"/:?">>().branded.toEqualTypeOf<{
				"": string | undefined;
			}>();
		});

		it("should resolve a bare '...?' segment to an empty-key optional rest value", () => {
			expectTypeOf<ExtractUrlParams<"/...?">>().branded.toEqualTypeOf<{
				"": string[] | undefined;
			}>();
		});
	});

	describe("input constraint", () => {
		it("should resolve to an empty record for the widened `string` type", () => {
			expectTypeOf<ExtractUrlParams<string>>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should distribute the `never` input to `never`", () => {
			expectTypeOf<ExtractUrlParams<never>>().toBeNever();
		});

		it("should resolve the `any` input to both conditional branches", () => {
			expectTypeOf<ExtractUrlParams<any>>().not.toBeAny();
			// `any` satisfies both sides of every conditional, so the recursion
			// yields the widened record unioned with the empty accumulator;
			// `Param` is the widened `string`, never a `?`-suffixed literal, so
			// the optional-parameter branch is unreachable here and no
			// `undefined` reaches the value type
			expectTypeOf<ExtractUrlParams<any>>().branded.toEqualTypeOf<
				Record<string, string | string[]> | NonNullable<unknown>
			>();
		});
	});

	describe("non-prefix markers treated as literal", () => {
		it("should ignore a ':' that is not at the start of a segment", () => {
			expectTypeOf<ExtractUrlParams<"/a:b">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should ignore a '...' that is not at the start of a segment", () => {
			expectTypeOf<ExtractUrlParams<"/a...b">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe("duplicate parameter names", () => {
		it("should let the last occurrence win when a name is repeated as required then optional", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/:p1?">
			>().branded.toEqualTypeOf<{ p1: string | undefined }>();
		});

		it("should agree with the runtime for a name reused as named param and rest", () => {
			// this used to intersect both param kinds into the uninhabited
			// `string & string[]`; the last occurrence wins now, which is what
			// the assignments src/core/jit.ts emits actually produce
			expectTypeOf<
				ExtractUrlParams<"/:p1/...p1">
			>().branded.toEqualTypeOf<{ p1: string[] }>();
			expectTypeOf<ExtractUrlParams<"/:p1/...p1">["p1"]>().toEqualTypeOf<
				string[]
			>();

			// the runtime instead lets the last occurrence win, mirroring the
			// assignments src/core/jit.ts emits: each capture is decoded in
			// order and the rest one overwrites the named one
			const { paramFlags, paramKeys, pattern } =
				pathToRegexp("/:p1/...p1");
			const match = new RegExp(`^${pattern}$`).exec("/v1/v2/v3");
			const params: Record<string, string | string[]> = {};

			for (let i = 0; i < paramKeys.length; i++) {
				const decoded = decodePathParam(match![2 + i]!);

				params[paramKeys[i]!] =
					(paramFlags[i]! & PARAM_FLAG_REST) !== 0
						? decoded.split("/")
						: decoded;
			}

			expect(params.p1).toEqual(["v2", "v3"]);
		});
	});

	describe("explicit Accumulated seed", () => {
		it("should merge extracted params into the provided seed record", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1", { c: string }>
			>().branded.toEqualTypeOf<{ c: string; p1: string }>();
		});

		it("should preserve the seed record for a literal-only path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/b", { c: string[] }>
			>().branded.toEqualTypeOf<{ c: string[] }>();
		});

		it("should accept a seed whose value type includes `undefined`", () => {
			expectTypeOf<
				ExtractUrlParams<"/b/:p2", { c: string | undefined }>
			>().branded.toEqualTypeOf<{ c: string | undefined; p2: string }>();
		});

		it("should accept its own output as a seed so the type composes", () => {
			expectTypeOf<
				ExtractUrlParams<"/b/:p2", ExtractUrlParams<"/a/:p1?">>
			>().branded.toEqualTypeOf<{ p1: string | undefined; p2: string }>();
		});
	});

	describe("negative assertions", () => {
		it("should not widen a required param to optional", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1">>().not.toEqualTypeOf<{
				p1: string | undefined;
			}>();
		});

		it("should not capture a key from a literal-only path", () => {
			expectTypeOf<ExtractUrlParams<"/a/b">>().not.toEqualTypeOf<{
				b: string;
			}>();
		});
	});
});
