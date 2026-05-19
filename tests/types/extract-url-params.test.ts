import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { ExtractUrlParams } from "@/types/extract-url-params";

describe("ExtractUrlParams", () => {
	describe("root path '/'", () => {
		test("should resolve to an empty record", () => {
			type Result = ExtractUrlParams<"/">;

			const check: ExtendsType<Result, NonNullable<unknown>> = true;

			expect(check).toBe(true);
		});
	});

	describe("empty path ''", () => {
		test("should resolve to an empty record", () => {
			type Result = ExtractUrlParams<"">;

			const check: ExtendsType<Result, NonNullable<unknown>> = true;

			expect(check).toBe(true);
		});
	});

	describe("literal segments", () => {
		test("should resolve to an empty record for a single literal segment", () => {
			type Result = ExtractUrlParams<"/health">;

			const check: ExtendsType<Result, NonNullable<unknown>> = true;

			expect(check).toBe(true);
		});

		test("should resolve to an empty record for a deeply nested literal path", () => {
			type Result = ExtractUrlParams<"/api/v1/health/check">;

			const check: ExtendsType<Result, NonNullable<unknown>> = true;

			expect(check).toBe(true);
		});
	});

	describe(":name required parameter", () => {
		test("should resolve a single ':name' segment to a `string` value", () => {
			type Result = ExtractUrlParams<"/users/:id">;

			const check: ExtendsType<Result, { id: string }> = true;

			expect(check).toBe(true);
		});

		test("should capture multiple required params in declaration order", () => {
			type Result = ExtractUrlParams<"/users/:user/posts/:post">;

			const check: ExtendsType<Result, { user: string; post: string }> =
				true;

			expect(check).toBe(true);
		});

		test("should capture two consecutive required params", () => {
			type Result = ExtractUrlParams<"/:a/:b">;

			const check: ExtendsType<Result, { a: string; b: string }> = true;

			expect(check).toBe(true);
		});

		test("should capture a required param as the only segment", () => {
			type Result = ExtractUrlParams<":only">;

			const check: ExtendsType<Result, { only: string }> = true;

			expect(check).toBe(true);
		});

		test("should capture a required param when the path has no leading slash", () => {
			type Result = ExtractUrlParams<"users/:id">;

			const check: ExtendsType<Result, { id: string }> = true;

			expect(check).toBe(true);
		});

		test("should capture a required param when the path has a trailing slash", () => {
			type Result = ExtractUrlParams<"/users/:id/">;

			const check: ExtendsType<Result, { id: string }> = true;

			expect(check).toBe(true);
		});
	});

	describe(":name? optional parameter", () => {
		test("should resolve a ':name?' segment to a `string | undefined` value", () => {
			type Result = ExtractUrlParams<"/users/:id?">;

			const check: ExtendsType<Result, { id: string | undefined }> = true;

			expect(check).toBe(true);
		});

		test("should capture an optional param in the middle of a path", () => {
			type Result = ExtractUrlParams<"/posts/:slug?/comments">;

			const check: ExtendsType<Result, { slug: string | undefined }> =
				true;

			expect(check).toBe(true);
		});

		test("should capture an optional param as the only segment", () => {
			type Result = ExtractUrlParams<":only?">;

			const check: ExtendsType<Result, { only: string | undefined }> =
				true;

			expect(check).toBe(true);
		});

		test("should accumulate two consecutive optional params", () => {
			type Result = ExtractUrlParams<"/:a?/:b?">;

			const check: ExtendsType<
				Result,
				{ a: string | undefined; b: string | undefined }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("...name rest parameter", () => {
		test("should resolve a '...name' segment to a `string[]` value", () => {
			type Result = ExtractUrlParams<"/files/...path">;

			const check: ExtendsType<Result, { path: string[] }> = true;

			expect(check).toBe(true);
		});

		test("should capture a required rest followed by a literal segment", () => {
			type Result = ExtractUrlParams<"/...rest/end">;

			const check: ExtendsType<Result, { rest: string[] }> = true;

			expect(check).toBe(true);
		});

		test("should capture a required rest as the only segment", () => {
			type Result = ExtractUrlParams<"...rest">;

			const check: ExtendsType<Result, { rest: string[] }> = true;

			expect(check).toBe(true);
		});

		test("should collect every rest param key when multiple are present", () => {
			type Result = ExtractUrlParams<"/...a/middle/...b">;

			const check: ExtendsType<Result, { a: string[]; b: string[] }> =
				true;

			expect(check).toBe(true);
		});
	});

	describe("...name? optional rest parameter", () => {
		test("should resolve a '...name?' segment to a `string[] | undefined` value", () => {
			type Result = ExtractUrlParams<"/files/...path?">;

			const check: ExtendsType<Result, { path: string[] | undefined }> =
				true;

			expect(check).toBe(true);
		});

		test("should capture an optional rest followed by a literal segment", () => {
			type Result = ExtractUrlParams<"/foo/...rest?/bar">;

			const check: ExtendsType<Result, { rest: string[] | undefined }> =
				true;

			expect(check).toBe(true);
		});

		test("should capture an optional rest as the only segment", () => {
			type Result = ExtractUrlParams<"...rest?">;

			const check: ExtendsType<Result, { rest: string[] | undefined }> =
				true;

			expect(check).toBe(true);
		});
	});

	describe("mixed segment types", () => {
		test("should accumulate a required param immediately followed by a rest", () => {
			type Result = ExtractUrlParams<"/:user/...path">;

			const check: ExtendsType<Result, { user: string; path: string[] }> =
				true;

			expect(check).toBe(true);
		});

		test("should accumulate required and optional named params", () => {
			type Result = ExtractUrlParams<"/users/:user/:tab?">;

			const check: ExtendsType<
				Result,
				{ user: string; tab: string | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should accumulate required and rest params separated by literals", () => {
			type Result = ExtractUrlParams<"/api/:version/files/...path">;

			const check: ExtendsType<
				Result,
				{ version: string; path: string[] }
			> = true;

			expect(check).toBe(true);
		});

		test("should accumulate every param kind in a single path", () => {
			type Result =
				ExtractUrlParams<"/api/:version/users/:user?/files/...path">;

			const check: ExtendsType<
				Result,
				{ version: string; user: string | undefined; path: string[] }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("resulting type (JSDoc examples)", () => {
		test("should match the documented type for '/users/:id'", () => {
			type Result = ExtractUrlParams<"/users/:id">;

			const check: ExtendsType<Result, { id: string }> = true;

			expect(check).toBe(true);
		});

		test("should match the documented type for '/posts/:slug?/comments'", () => {
			type Result = ExtractUrlParams<"/posts/:slug?/comments">;

			const check: ExtendsType<Result, { slug: string | undefined }> =
				true;

			expect(check).toBe(true);
		});

		test("should match the documented type for '/files/...path'", () => {
			type Result = ExtractUrlParams<"/files/...path">;

			const check: ExtendsType<Result, { path: string[] }> = true;

			expect(check).toBe(true);
		});

		test("should match the documented type for '/health'", () => {
			type Result = ExtractUrlParams<"/health">;

			const check: ExtendsType<Result, NonNullable<unknown>> = true;

			expect(check).toBe(true);
		});
	});
});
