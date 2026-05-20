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
			expectTypeOf<ExtractUrlParams<"/health">>().branded.toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should resolve to an empty record for a deeply nested literal path", () => {
			expectTypeOf<
				ExtractUrlParams<"/api/v1/health/check">
			>().branded.toEqualTypeOf<NonNullable<unknown>>();
		});
	});

	describe(":name required parameter", () => {
		test("should resolve a single ':name' segment to a `string` value", () => {
			expectTypeOf<
				ExtractUrlParams<"/users/:id">
			>().branded.toEqualTypeOf<{ id: string }>();
		});

		test("should capture multiple required params in declaration order", () => {
			expectTypeOf<
				ExtractUrlParams<"/users/:user/posts/:post">
			>().branded.toEqualTypeOf<{ user: string; post: string }>();
		});

		test("should capture two consecutive required params", () => {
			expectTypeOf<ExtractUrlParams<"/:a/:b">>().branded.toEqualTypeOf<{
				a: string;
				b: string;
			}>();
		});

		test("should capture a required param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":only">>().branded.toEqualTypeOf<{
				only: string;
			}>();
		});

		test("should capture a required param when the path has no leading slash", () => {
			expectTypeOf<
				ExtractUrlParams<"users/:id">
			>().branded.toEqualTypeOf<{ id: string }>();
		});

		test("should capture a required param when the path has a trailing slash", () => {
			expectTypeOf<
				ExtractUrlParams<"/users/:id/">
			>().branded.toEqualTypeOf<{ id: string }>();
		});
	});

	describe(":name? optional parameter", () => {
		test("should resolve a ':name?' segment to a `string | undefined` value", () => {
			expectTypeOf<
				ExtractUrlParams<"/users/:id?">
			>().branded.toEqualTypeOf<{ id: string | undefined }>();
		});

		test("should capture an optional param in the middle of a path", () => {
			expectTypeOf<
				ExtractUrlParams<"/posts/:slug?/comments">
			>().branded.toEqualTypeOf<{ slug: string | undefined }>();
		});

		test("should capture an optional param as the only segment", () => {
			expectTypeOf<ExtractUrlParams<":only?">>().branded.toEqualTypeOf<{
				only: string | undefined;
			}>();
		});

		test("should accumulate two consecutive optional params", () => {
			expectTypeOf<ExtractUrlParams<"/:a?/:b?">>().branded.toEqualTypeOf<{
				a: string | undefined;
				b: string | undefined;
			}>();
		});
	});

	describe("...name rest parameter", () => {
		test("should resolve a '...name' segment to a `string[]` value", () => {
			expectTypeOf<
				ExtractUrlParams<"/files/...path">
			>().branded.toEqualTypeOf<{ path: string[] }>();
		});

		test("should capture a required rest followed by a literal segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/...rest/end">
			>().branded.toEqualTypeOf<{ rest: string[] }>();
		});

		test("should capture a required rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...rest">>().branded.toEqualTypeOf<{
				rest: string[];
			}>();
		});

		test("should collect every rest param key when multiple are present", () => {
			expectTypeOf<
				ExtractUrlParams<"/...a/middle/...b">
			>().branded.toEqualTypeOf<{ a: string[]; b: string[] }>();
		});
	});

	describe("...name? optional rest parameter", () => {
		test("should resolve a '...name?' segment to a `string[] | undefined` value", () => {
			expectTypeOf<
				ExtractUrlParams<"/files/...path?">
			>().branded.toEqualTypeOf<{ path: string[] | undefined }>();
		});

		test("should capture an optional rest followed by a literal segment", () => {
			expectTypeOf<
				ExtractUrlParams<"/foo/...rest?/bar">
			>().branded.toEqualTypeOf<{ rest: string[] | undefined }>();
		});

		test("should capture an optional rest as the only segment", () => {
			expectTypeOf<ExtractUrlParams<"...rest?">>().branded.toEqualTypeOf<{
				rest: string[] | undefined;
			}>();
		});
	});

	describe("mixed segment types", () => {
		test("should accumulate a required param immediately followed by a rest", () => {
			expectTypeOf<
				ExtractUrlParams<"/:user/...path">
			>().branded.toEqualTypeOf<{ user: string; path: string[] }>();
		});

		test("should accumulate required and optional named params", () => {
			expectTypeOf<
				ExtractUrlParams<"/users/:user/:tab?">
			>().branded.toEqualTypeOf<{
				user: string;
				tab: string | undefined;
			}>();
		});

		test("should accumulate required and rest params separated by literals", () => {
			expectTypeOf<
				ExtractUrlParams<"/api/:version/files/...path">
			>().branded.toEqualTypeOf<{ version: string; path: string[] }>();
		});

		test("should accumulate every param kind in a single path", () => {
			expectTypeOf<
				ExtractUrlParams<"/api/:version/users/:user?/files/...path">
			>().branded.toEqualTypeOf<{
				version: string;
				user: string | undefined;
				path: string[];
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
