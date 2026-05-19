import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { MergePaths } from "@/types/merge-paths";

describe("MergePaths", () => {
	describe("typical concatenation", () => {
		test("should join a non-root prefix with a non-root path", () => {
			const check: ExtendsType<
				MergePaths<"/api", "/users">,
				"/api/users"
			> = true;

			expect(check).toBe(true);
		});

		test("should join multi-segment prefix with multi-segment path", () => {
			const check: ExtendsType<
				MergePaths<"/api/v1", "/users/list">,
				"/api/v1/users/list"
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve dynamic-segment markers in the joined string", () => {
			const check: ExtendsType<
				MergePaths<"/api", "/users/:id">,
				"/api/users/:id"
			> = true;

			expect(check).toBe(true);
		});

		test("should preserve rest-segment markers in the joined string", () => {
			const check: ExtendsType<
				MergePaths<"/files", "/...path">,
				"/files/...path"
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("root-path handling", () => {
		test("should collapse a root prefix to the path itself", () => {
			const check: ExtendsType<
				MergePaths<"/", "/users">,
				"/users"
			> = true;

			expect(check).toBe(true);
		});

		test("should collapse a root path to the prefix itself", () => {
			const check: ExtendsType<MergePaths<"/api", "/">, "/api"> = true;

			expect(check).toBe(true);
		});

		test("should resolve `/` + `/` to `/`", () => {
			const check: ExtendsType<MergePaths<"/", "/">, "/"> = true;

			expect(check).toBe(true);
		});
	});

	describe("trailing-slash normalization", () => {
		test("should strip a trailing slash from the prefix", () => {
			const check: ExtendsType<
				MergePaths<"/api/", "/users">,
				"/api/users"
			> = true;

			expect(check).toBe(true);
		});

		test("should strip a trailing slash from the path", () => {
			const check: ExtendsType<
				MergePaths<"/api", "/users/">,
				"/api/users"
			> = true;

			expect(check).toBe(true);
		});

		test("should strip a trailing slash from both sides", () => {
			const check: ExtendsType<
				MergePaths<"/api/", "/users/">,
				"/api/users"
			> = true;

			expect(check).toBe(true);
		});

		test("should strip a trailing slash from the path when the prefix is root", () => {
			const check: ExtendsType<
				MergePaths<"/", "/users/">,
				"/users"
			> = true;

			expect(check).toBe(true);
		});

		test("should strip a trailing slash from the prefix when the path is root", () => {
			const check: ExtendsType<MergePaths<"/api/", "/">, "/api"> = true;

			expect(check).toBe(true);
		});
	});

	describe("structural relations", () => {
		test("should distribute over a union of prefixes", () => {
			type Result = MergePaths<"/api" | "/admin", "/users">;

			const check: ExtendsType<Result, "/api/users" | "/admin/users"> =
				true;

			expect(check).toBe(true);
		});

		test("should distribute over a union of paths", () => {
			type Result = MergePaths<"/api", "/users" | "/posts">;

			const check: ExtendsType<Result, "/api/users" | "/api/posts"> =
				true;

			expect(check).toBe(true);
		});

		test("should produce a string-literal type, not a widened `string`", () => {
			type Result = MergePaths<"/a", "/b">;

			const check: ExtendsType<Result, string> = false;

			expect(check).toBe(false);
		});

		test("should preserve literal-ness when both sides carry trailing slashes", () => {
			type Result = MergePaths<"/api/", "/users/">;

			const check: ExtendsType<Result, string> = false;

			expect(check).toBe(false);
		});
	});
});
