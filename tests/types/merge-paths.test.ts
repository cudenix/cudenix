import { describe, expectTypeOf, test } from "bun:test";

import type { MergePaths } from "@/types/merge-paths";

describe("MergePaths", () => {
	describe("typical concatenation", () => {
		test("should join a non-root prefix with a non-root path", () => {
			expectTypeOf<
				MergePaths<"/api", "/users">
			>().toEqualTypeOf<"/api/users">();
		});

		test("should join a multi-segment prefix with a multi-segment path", () => {
			expectTypeOf<
				MergePaths<"/api/v1", "/users/list">
			>().toEqualTypeOf<"/api/v1/users/list">();
		});

		test("should preserve dynamic-segment markers in the joined string", () => {
			expectTypeOf<
				MergePaths<"/api", "/users/:id">
			>().toEqualTypeOf<"/api/users/:id">();
		});

		test("should preserve rest-segment markers in the joined string", () => {
			expectTypeOf<
				MergePaths<"/files", "/...path">
			>().toEqualTypeOf<"/files/...path">();
		});
	});

	describe("root-path handling", () => {
		test("should collapse a root prefix to the path itself", () => {
			expectTypeOf<MergePaths<"/", "/users">>().toEqualTypeOf<"/users">();
		});

		test("should collapse a root path to the prefix itself", () => {
			expectTypeOf<MergePaths<"/api", "/">>().toEqualTypeOf<"/api">();
		});

		test("should resolve `/` + `/` to `/`", () => {
			expectTypeOf<MergePaths<"/", "/">>().toEqualTypeOf<"/">();
		});
	});

	describe("trailing-slash normalization", () => {
		describe("on a single side", () => {
			test("should strip a trailing slash from the prefix", () => {
				expectTypeOf<
					MergePaths<"/api/", "/users">
				>().toEqualTypeOf<"/api/users">();
			});

			test("should strip a trailing slash from the path", () => {
				expectTypeOf<
					MergePaths<"/api", "/users/">
				>().toEqualTypeOf<"/api/users">();
			});
		});

		describe("on both sides", () => {
			test("should strip a trailing slash from both sides", () => {
				expectTypeOf<
					MergePaths<"/api/", "/users/">
				>().toEqualTypeOf<"/api/users">();
			});
		});

		describe("combined with root handling", () => {
			test("should strip a trailing slash from the path when the prefix is root", () => {
				expectTypeOf<
					MergePaths<"/", "/users/">
				>().toEqualTypeOf<"/users">();
			});

			test("should strip a trailing slash from the prefix when the path is root", () => {
				expectTypeOf<
					MergePaths<"/api/", "/">
				>().toEqualTypeOf<"/api">();
			});
		});
	});

	describe("structural relations", () => {
		describe("union distribution", () => {
			test("should distribute over a union of prefixes", () => {
				expectTypeOf<MergePaths<"/api" | "/admin", "/users">>().toEqualTypeOf<
					"/api/users" | "/admin/users"
				>();
			});

			test("should distribute over a union of paths", () => {
				expectTypeOf<MergePaths<"/api", "/users" | "/posts">>().toEqualTypeOf<
					"/api/users" | "/api/posts"
				>();
			});
		});

		describe("input constraint", () => {
			test("should reject a prefix without a leading slash at compile time", () => {
				// @ts-expect-error - Prefix must start with '/'
				type _A = MergePaths<"api", "/users">;
			});

			test("should reject a path without a leading slash at compile time", () => {
				// @ts-expect-error - Path must start with '/'
				type _B = MergePaths<"/api", "users">;
			});
		});

		describe("literal-type preservation", () => {
			test("should produce a string-literal type, not a widened `string`", () => {
				expectTypeOf<
					MergePaths<"/a", "/b">
				>().not.toEqualTypeOf<string>();
			});

			test("should preserve literal-ness when both sides carry trailing slashes", () => {
				expectTypeOf<
					MergePaths<"/api/", "/users/">
				>().not.toEqualTypeOf<string>();
			});
		});
	});
});
