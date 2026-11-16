import { describe, expectTypeOf, it } from "bun:test";

import type { ExtractUrlParams } from "@/utils/types/extract-url-params";

type Empty = NonNullable<unknown>;
type RestParam = [string, ...string[]];

describe("ExtractUrlParams", () => {
	describe("paths without captures", () => {
		it("should resolve to an empty record", () => {
			expectTypeOf<ExtractUrlParams<"/">>().toEqualTypeOf<Empty>();
			expectTypeOf<ExtractUrlParams<"/a/*/b">>().toEqualTypeOf<Empty>();
		});

		it("should ignore a marker that does not start a segment", () => {
			expectTypeOf<ExtractUrlParams<"/a:b">>().toEqualTypeOf<Empty>();
			expectTypeOf<ExtractUrlParams<"/a...b">>().toEqualTypeOf<Empty>();
		});
	});

	describe("captures", () => {
		it("should resolve ':name' to a required string", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1/b/:p2">>().toEqualTypeOf<{
				p1: string;
				p2: string;
			}>();
		});

		it("should resolve ':name?' to an optional string", () => {
			expectTypeOf<ExtractUrlParams<"/a/:p1?/b">>().toEqualTypeOf<{
				p1?: string | undefined;
			}>();
		});

		it("should resolve '...name' to a required non-empty tuple", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1">>().toEqualTypeOf<{
				r1: RestParam;
			}>();
		});

		it("should resolve '...name?' to an optional non-empty tuple", () => {
			expectTypeOf<ExtractUrlParams<"/a/...r1?/b">>().toEqualTypeOf<{
				r1?: RestParam | undefined;
			}>();
		});

		it("should keep capturing after a rest segment", () => {
			expectTypeOf<ExtractUrlParams<"/...r1/:p1/...r2">>().toEqualTypeOf<{
				p1: string;
				r1: RestParam;
				r2: RestParam;
			}>();
		});

		it("should accumulate every kind of capture in one path", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1/b/:p2?/c/...r1">
			>().toEqualTypeOf<{
				p1: string;
				p2?: string | undefined;
				r1: RestParam;
			}>();
		});

		it("should capture without a leading slash and with a trailing one", () => {
			expectTypeOf<ExtractUrlParams<":p1">>().toEqualTypeOf<{
				p1: string;
			}>();
			expectTypeOf<ExtractUrlParams<"...r1/">>().toEqualTypeOf<{
				r1: RestParam;
			}>();
		});

		it("should treat backslashes as separators", () => {
			expectTypeOf<
				ExtractUrlParams<"/a\\:p1?//\\...r1\\b">
			>().toEqualTypeOf<{ p1?: string | undefined; r1: RestParam }>();
		});
	});

	describe("duplicate names", () => {
		it("should let a later required capture replace the earlier one", () => {
			expectTypeOf<ExtractUrlParams<"/:p1?/:p1">>().toEqualTypeOf<{
				p1: string;
			}>();
			expectTypeOf<ExtractUrlParams<"/:p1/...p1">>().toEqualTypeOf<{
				p1: RestParam;
			}>();
		});

		it("should union a later optional capture with a required earlier one", () => {
			expectTypeOf<ExtractUrlParams<"/:p1/...p1?">>().toEqualTypeOf<{
				p1: RestParam | string;
			}>();
		});

		it("should stay optional only when every occurrence is optional", () => {
			expectTypeOf<ExtractUrlParams<"/:p1?/...p1?">>().toEqualTypeOf<{
				p1?: RestParam | string | undefined;
			}>();
		});
	});

	describe("paths that are not a single literal", () => {
		it("should distribute over a union of paths", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/:p1" | "/a/b" | "/c\\:p2">
			>().toEqualTypeOf<{ p1: string } | { p2: string } | Empty>();
		});

		it("should resolve to an empty record for `string`", () => {
			expectTypeOf<ExtractUrlParams<string>>().toEqualTypeOf<Empty>();
		});

		it("should resolve to no params or any params for `any`", () => {
			expectTypeOf<ExtractUrlParams<any>>().toEqualTypeOf<
				Empty | Record<string, RestParam | string>
			>();
		});
	});

	describe("accumulated params", () => {
		it("should keep them when the path has no captures", () => {
			expectTypeOf<
				ExtractUrlParams<"/a/b", { p1: string | undefined }>
			>().toEqualTypeOf<{ p1: string | undefined }>();
		});

		it("should add the captures of the path to its own earlier output", () => {
			expectTypeOf<
				ExtractUrlParams<"/b/:p2", ExtractUrlParams<"/a/:p1?">>
			>().toEqualTypeOf<{ p1?: string | undefined; p2: string }>();
		});

		it("should let a capture of the path replace an accumulated one", () => {
			expectTypeOf<
				ExtractUrlParams<"/...p1", { p1: string }>
			>().toEqualTypeOf<{ p1: RestParam }>();
		});
	});
});
