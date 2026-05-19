import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { ExtractUrlParams } from "@/types/extract-url-params";

describe("ExtractUrlParams", () => {
	describe("paths without parameters", () => {
		test("should resolve to an empty record for the root path", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/">,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to an empty record for a fully literal path", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/health">,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to an empty record for a deeply nested literal path", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/api/v1/health/check">,
				NonNullable<unknown>
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("required named parameters", () => {
		test("should capture a single required `:name` segment as `string`", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/users/:id">,
				{ id: string }
			> = true;

			expect(check).toBe(true);
		});

		test("should capture multiple required params in declaration order", () => {
			type Result = ExtractUrlParams<"/users/:user/posts/:post">;

			const check: ExtendsType<Result, { user: string; post: string }> =
				true;

			expect(check).toBe(true);
		});

		test("should capture a required param that is the only segment", () => {
			const check: ExtendsType<
				ExtractUrlParams<":only">,
				{ only: string }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("optional named parameters", () => {
		test("should resolve an optional param to `string | undefined`", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/posts/:slug?/comments">,
				{ slug: string | undefined }
			> = true;

			expect(check).toBe(true);
		});

		test("should support an optional param as the trailing segment", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/users/:id?">,
				{ id: string | undefined }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("rest parameters", () => {
		test("should resolve a required `...name` segment to `string[]`", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/files/...path">,
				{ path: string[] }
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve a required rest as the only segment", () => {
			const check: ExtendsType<
				ExtractUrlParams<"...rest">,
				{ rest: string[] }
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve an optional rest to `string[] | undefined`", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/files/...path?">,
				{ path: string[] | undefined }
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("mixed segments", () => {
		test("should accumulate required and rest params side-by-side", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/api/:version/files/...path">,
				{ version: string; path: string[] }
			> = true;

			expect(check).toBe(true);
		});

		test("should accumulate required and optional named params", () => {
			const check: ExtendsType<
				ExtractUrlParams<"/users/:user/:tab?">,
				{ user: string; tab: string | undefined }
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
});
