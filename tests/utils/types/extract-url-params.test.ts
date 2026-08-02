import { describe, expect, expectTypeOf, it } from "bun:test";

import {
	PARAM_FLAG_OPTIONAL,
	PARAM_FLAG_REST,
	pathToRegexp,
} from "@/utils/regexps/path-to-regexp";
import type { ExtractUrlParams } from "@/utils/types/extract-url-params";
import { decodePathParam } from "@/utils/urls/decode-path-param";

type RestParam = [string, ...string[]];

const parseParams = (path: string, url: string) => {
	const { paramFlags, paramKeys, pattern } = pathToRegexp(path);
	const match = new RegExp(`^${pattern}$`).exec(url);

	if (!match) {
		throw new Error(`Expected "${url}" to match "${path}"`);
	}

	const params: Record<string, string | string[]> = {};

	for (let i = 0; i < paramKeys.length; i++) {
		const key = paramKeys[i];
		const flags = paramFlags[i];
		const captured = match[2 + i];

		if (key === undefined || flags === undefined) {
			continue;
		}

		if (captured === undefined && (flags & PARAM_FLAG_OPTIONAL) !== 0) {
			continue;
		}

		if (captured === undefined) {
			throw new Error(`Missing required capture for "${key}"`);
		}

		params[key] =
			(flags & PARAM_FLAG_REST) !== 0
				? captured.split("/").map(decodePathParam)
				: decodePathParam(captured);
	}

	return params;
};

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
		it("should resolve a ':name?' segment to an optional string property", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1?">>().branded.toEqualTypeOf<{
				p1?: string | undefined;
			}>();
		});

		it("should capture an optional param in the middle of a path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1?/b">
			>().branded.toEqualTypeOf<{ p1?: string | undefined }>();
		});

		it("should capture an optional param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":p1?">>().branded.toEqualTypeOf<{
				p1?: string | undefined;
			}>();
		});

		it("should accumulate two consecutive optional params", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1?/:p2?">
			>().branded.toEqualTypeOf<{
				p1?: string | undefined;
				p2?: string | undefined;
			}>();
		});

		it("should accept the runtime shape when an optional param is absent", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<
				ExtractUrlParams<"/a/:p1?">
			>();
			expectTypeOf<{ p1: string }>().toExtend<
				ExtractUrlParams<"/a/:p1?">
			>();
		});

		it("should still require a required sibling when the optional param is absent", () => {
			expectTypeOf<{ p1: string }>().toExtend<
				ExtractUrlParams<"/:p1/:p2?">
			>();
			expectTypeOf<NonNullable<unknown>>().not.toExtend<
				ExtractUrlParams<"/:p1/:p2?">
			>();
		});
	});

	describe("...name rest parameter", () => {
		it("should resolve a '...name' segment to a non-empty tuple", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1">>().branded.toEqualTypeOf<{
				r1: RestParam;
			}>();
		});

		it("should capture a required rest followed by a literal segment", () => {
			expectTypeOf<ExtractUrlParams<"/...r1/a">>().branded.toEqualTypeOf<{
				r1: RestParam;
			}>();
		});

		it("should keep capturing a named param that follows a rest segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/...r1/:p1">
			>().branded.toEqualTypeOf<{ r1: RestParam; p1: string }>();
		});

		it("should capture a required rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...r1">>().branded.toEqualTypeOf<{
				r1: RestParam;
			}>();
		});

		it("should collect every rest param key when multiple are present", () => {
			expectTypeOf<
				ExtractUrlParams<"/...r1/a/...r2">
			>().branded.toEqualTypeOf<{ r1: RestParam; r2: RestParam }>();
		});

		it("should guard the rest element type against an `any[]` regression that branded equality cannot see", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1">["r1"]
			>().toEqualTypeOf<RestParam>();
		});

		it("should reject an empty array for a required rest", () => {
			expectTypeOf<{ r1: [] }>().not.toExtend<
				ExtractUrlParams<"/a/...r1">
			>();
			expectTypeOf<{ r1: [string] }>().toExtend<
				ExtractUrlParams<"/a/...r1">
			>();
		});
	});

	describe("...name? optional rest parameter", () => {
		it("should resolve a '...name?' segment to an optional string-array property", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1?">
			>().branded.toEqualTypeOf<{ r1?: RestParam | undefined }>();
		});

		it("should capture an optional rest followed by a literal segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1?/b">
			>().branded.toEqualTypeOf<{ r1?: RestParam | undefined }>();
		});

		it("should capture an optional rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...r1?">>().branded.toEqualTypeOf<{
				r1?: RestParam | undefined;
			}>();
		});

		it("should guard the optional rest element type against an `any[]` regression that branded equality cannot see", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1?">["r1"]>().toEqualTypeOf<
				RestParam | undefined
			>();
		});

		it("should accept the runtime shape when an optional rest is absent", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<
				ExtractUrlParams<"/a/...r1?">
			>();
			expectTypeOf<{ r1: [string] }>().toExtend<
				ExtractUrlParams<"/a/...r1?">
			>();
		});

		it("should reject an empty array when an optional rest is present", () => {
			expectTypeOf<{ r1: [] }>().not.toExtend<
				ExtractUrlParams<"/a/...r1?">
			>();
		});
	});

	describe("mixed segment types", () => {
		it("should accumulate a required param immediately followed by a rest", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/...r1">
			>().branded.toEqualTypeOf<{ p1: string; r1: RestParam }>();
		});

		it("should accumulate required and optional named params", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/:p2?">
			>().branded.toEqualTypeOf<{
				p1: string;
				p2?: string | undefined;
			}>();
		});

		it("should accumulate required and rest params separated by literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">
			>().branded.toEqualTypeOf<{ p1: string; r1: RestParam }>();
		});

		it("should accumulate every param kind in a single path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/:p2?/c/...r1">
			>().branded.toEqualTypeOf<{
				p1: string;
				p2?: string | undefined;
				r1: RestParam;
			}>();
		});

		it("should accumulate an optional param and a rest separated by literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1?/b/...r1">
			>().branded.toEqualTypeOf<{
				p1?: string | undefined;
				r1: RestParam;
			}>();
		});

		it("should guard both named and rest value types against an `any[]` regression that branded equality cannot see", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">["p1"]
			>().toEqualTypeOf<string>();
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">["r1"]
			>().toEqualTypeOf<RestParam>();
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

		it("should resolve a bare '...' segment to an empty-key non-empty tuple", () => {
			expectTypeOf<ExtractUrlParams<"/...">>().branded.toEqualTypeOf<{
				"": RestParam;
			}>();
		});

		it("should resolve a bare ':?' segment to an empty-key optional value", () => {
			expectTypeOf<ExtractUrlParams<"/:?">>().branded.toEqualTypeOf<{
				""?: string | undefined;
			}>();
		});

		it("should resolve a bare '...?' segment to an empty-key optional rest value", () => {
			expectTypeOf<ExtractUrlParams<"/...?">>().branded.toEqualTypeOf<{
				""?: RestParam | undefined;
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
			// biome-ignore lint/suspicious/noExplicitAny: Testing an `any` path
			expectTypeOf<ExtractUrlParams<any>>().not.toBeAny();
			// biome-ignore lint/suspicious/noExplicitAny: Testing an `any` path
			expectTypeOf<ExtractUrlParams<any>>().toEqualTypeOf<
				Record<string, string | RestParam> | NonNullable<unknown>
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
		it("should keep a prior required name required when a later capture is optional", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/:p1?">
			>().branded.toEqualTypeOf<{ p1: string }>();
		});

		it("should let a required occurrence replace an earlier optional one", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1?/:p1">
			>().branded.toEqualTypeOf<{ p1: string }>();
		});

		it("should agree with the runtime for a name reused as named param and rest", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/...p1">
			>().branded.toEqualTypeOf<{ p1: RestParam }>();
			expectTypeOf<
				ExtractUrlParams<"/:p1/...p1">["p1"]
			>().toEqualTypeOf<RestParam>();

			expect(parseParams("/:p1/...p1", "/v1/v2%2Fv3/v4").p1).toEqual([
				"v2/v3",
				"v4",
			]);
		});

		it("should preserve the prior value when the last duplicate is optional and absent", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/...p1?">
			>().branded.toEqualTypeOf<{ p1: string | RestParam }>();
			expectTypeOf<NonNullable<unknown>>().not.toExtend<
				ExtractUrlParams<"/:p1/...p1?">
			>();

			expect(parseParams("/:p1/...p1?", "/v1")).toEqual({ p1: "v1" });
		});

		it("should overwrite the prior value when the last duplicate is optional and present", () => {
			expect(parseParams("/:p1/...p1?", "/v1/v2%2Fv3/v4")).toEqual({
				p1: ["v2/v3", "v4"],
			});
		});

		it("should keep a duplicated name optional only when every occurrence is optional", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1?/...p1?">
			>().branded.toEqualTypeOf<{
				p1?: string | RestParam | undefined;
			}>();

			expect(parseParams("/:p1?/...p1?", "/")).toEqual({});
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
			>().branded.toEqualTypeOf<{
				p1?: string | undefined;
				p2: string;
			}>();
		});
	});

	describe("negative assertions", () => {
		it("should not widen a required param to optional", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1">>().not.toEqualTypeOf<{
				p1?: string | undefined;
			}>();
		});

		it("should not capture a key from a literal-only path", () => {
			expectTypeOf<ExtractUrlParams<"/a/b">>().not.toEqualTypeOf<{
				b: string;
			}>();
		});
	});
});
