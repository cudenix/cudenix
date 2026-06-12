import { describe, expectTypeOf, it } from "bun:test";

import type { ExtractUrlParams } from "@/utils/types/extract-url-params";

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
	});
});
