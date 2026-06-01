import { describe, expectTypeOf, test } from "bun:test";

import type { ExtractUrlParams } from "@/types/extract-url-params";

describe("ExtractUrlParams", () => {
	describe("root path '/'", () => {
		test("should resolve to an empty record", () => {
			expectTypeOf<ExtractUrlParams<"/">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe("empty path ''", () => {
		test("should resolve to an empty record", () => {
			expectTypeOf<ExtractUrlParams<"">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe("literal segments", () => {
		test("should resolve to an empty record for a single literal segment", () => {
			expectTypeOf<ExtractUrlParams<"/a">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should resolve to an empty record for a deeply nested literal path", () => {
			expectTypeOf<ExtractUrlParams<"/a/b/c/d">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});
	});

	describe(":name required parameter", () => {
		test("should resolve a single ':name' segment to a `string` value", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});

		test("should capture multiple required params in declaration order", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/:p2">
			>().branded.toEqualTypeOf<{ p1: string; p2: string }>();
		});

		test("should capture two consecutive required params", () => {
			expectTypeOf<ExtractUrlParams<"/:p1/:p2">>().branded.toEqualTypeOf<{
				p1: string;
				p2: string;
			}>();
		});

		test("should capture a required param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":p1">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});

		test("should capture a required param when the path has no leading slash", () => {
			expectTypeOf<ExtractUrlParams<"a/:p1">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});

		test("should capture a required param when the path has a trailing slash", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1/">>().branded.toEqualTypeOf<{
				p1: string;
			}>();
		});
	});

	describe(":name? optional parameter", () => {
		test("should resolve a ':name?' segment to a `string | undefined` value", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1?">>().branded.toEqualTypeOf<{
				p1: string | undefined;
			}>();
		});

		test("should capture an optional param in the middle of a path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1?/b">
			>().branded.toEqualTypeOf<{ p1: string | undefined }>();
		});

		test("should capture an optional param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":p1?">>().branded.toEqualTypeOf<{
				p1: string | undefined;
			}>();
		});

		test("should accumulate two consecutive optional params", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1?/:p2?">
			>().branded.toEqualTypeOf<{
				p1: string | undefined;
				p2: string | undefined;
			}>();
		});
	});

	describe("...name rest parameter", () => {
		test("should resolve a '...name' segment to a `string[]` value", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1">>().branded.toEqualTypeOf<{
				r1: string[];
			}>();
		});

		test("should capture a required rest followed by a literal segment", () => {
			expectTypeOf<ExtractUrlParams<"/...r1/a">>().branded.toEqualTypeOf<{
				r1: string[];
			}>();
		});

		test("should capture a required rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...r1">>().branded.toEqualTypeOf<{
				r1: string[];
			}>();
		});

		test("should collect every rest param key when multiple are present", () => {
			expectTypeOf<
				ExtractUrlParams<"/...r1/a/...r2">
			>().branded.toEqualTypeOf<{ r1: string[]; r2: string[] }>();
		});
	});

	describe("...name? optional rest parameter", () => {
		test("should resolve a '...name?' segment to a `string[] | undefined` value", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1?">
			>().branded.toEqualTypeOf<{ r1: string[] | undefined }>();
		});

		test("should capture an optional rest followed by a literal segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/...r1?/b">
			>().branded.toEqualTypeOf<{ r1: string[] | undefined }>();
		});

		test("should capture an optional rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...r1?">>().branded.toEqualTypeOf<{
				r1: string[] | undefined;
			}>();
		});
	});

	describe("mixed segment types", () => {
		test("should accumulate a required param immediately followed by a rest", () => {
			expectTypeOf<
				ExtractUrlParams<"/:p1/...r1">
			>().branded.toEqualTypeOf<{ p1: string; r1: string[] }>();
		});

		test("should accumulate required and optional named params", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/:p2?">
			>().branded.toEqualTypeOf<{ p1: string; p2: string | undefined }>();
		});

		test("should accumulate required and rest params separated by literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/...r1">
			>().branded.toEqualTypeOf<{ p1: string; r1: string[] }>();
		});

		test("should accumulate every param kind in a single path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/:p2?/c/...r1">
			>().branded.toEqualTypeOf<{
				p1: string;
				p2: string | undefined;
				r1: string[];
			}>();
		});
	});

	describe("empty parameter names", () => {
		test("should resolve a bare ':' segment to an empty-key string value", () => {
			expectTypeOf<ExtractUrlParams<"/:">>().branded.toEqualTypeOf<{
				"": string;
			}>();
		});

		test("should resolve a bare '...' segment to an empty-key string[] value", () => {
			expectTypeOf<ExtractUrlParams<"/...">>().branded.toEqualTypeOf<{
				"": string[];
			}>();
		});

		test("should resolve a bare ':?' segment to an empty-key optional value", () => {
			expectTypeOf<ExtractUrlParams<"/:?">>().branded.toEqualTypeOf<{
				"": string | undefined;
			}>();
		});

		test("should resolve a bare '...?' segment to an empty-key optional rest value", () => {
			expectTypeOf<ExtractUrlParams<"/...?">>().branded.toEqualTypeOf<{
				"": string[] | undefined;
			}>();
		});
	});
});
