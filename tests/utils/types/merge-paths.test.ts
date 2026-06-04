import { describe, expectTypeOf, test } from "bun:test";

import type { MergePaths } from "@/utils/types/merge-paths";

describe("MergePaths", () => {
	describe("typical concatenation", () => {
		test("should join a non-root prefix with a non-root path", () => {
			expectTypeOf<MergePaths<"/a", "/b">>().toEqualTypeOf<"/a/b">();
		});

		test("should join a multi-segment prefix with a multi-segment path", () => {
			expectTypeOf<
				MergePaths<"/a/b", "/c/d">
			>().toEqualTypeOf<"/a/b/c/d">();
		});

		test("should preserve dynamic-segment markers in the joined string", () => {
			expectTypeOf<
				MergePaths<"/a", "/b/:p1">
			>().toEqualTypeOf<"/a/b/:p1">();
		});

		test("should preserve rest-segment markers in the joined string", () => {
			expectTypeOf<
				MergePaths<"/a", "/...r1">
			>().toEqualTypeOf<"/a/...r1">();
		});

		test("should preserve a wildcard marker in the joined string", () => {
			expectTypeOf<MergePaths<"/a", "/*">>().toEqualTypeOf<"/a/*">();
		});
	});

	describe("root-path handling", () => {
		test("should collapse a root prefix to the path itself", () => {
			expectTypeOf<MergePaths<"/", "/a">>().toEqualTypeOf<"/a">();
		});

		test("should collapse a root path to the prefix itself", () => {
			expectTypeOf<MergePaths<"/a", "/">>().toEqualTypeOf<"/a">();
		});

		test("should resolve `/` + `/` to `/`", () => {
			expectTypeOf<MergePaths<"/", "/">>().toEqualTypeOf<"/">();
		});
	});

	describe("trailing-slash normalization", () => {
		describe("on a single side", () => {
			test("should strip a trailing slash from the prefix", () => {
				expectTypeOf<MergePaths<"/a/", "/b">>().toEqualTypeOf<"/a/b">();
			});

			test("should strip a trailing slash from the path", () => {
				expectTypeOf<MergePaths<"/a", "/b/">>().toEqualTypeOf<"/a/b">();
			});
		});

		describe("on both sides", () => {
			test("should strip a trailing slash from both sides", () => {
				expectTypeOf<
					MergePaths<"/a/", "/b/">
				>().toEqualTypeOf<"/a/b">();
			});
		});

		describe("combined with root handling", () => {
			test("should strip a trailing slash from the path when the prefix is root", () => {
				expectTypeOf<MergePaths<"/", "/a/">>().toEqualTypeOf<"/a">();
			});

			test("should strip a trailing slash from the prefix when the path is root", () => {
				expectTypeOf<MergePaths<"/a/", "/">>().toEqualTypeOf<"/a">();
			});
		});
	});

	describe("structural relations", () => {
		describe("union distribution", () => {
			test("should distribute over a union of prefixes", () => {
				expectTypeOf<MergePaths<"/a" | "/b", "/c">>().toEqualTypeOf<
					"/a/c" | "/b/c"
				>();
			});

			test("should distribute over a union of paths", () => {
				expectTypeOf<MergePaths<"/a", "/b" | "/c">>().toEqualTypeOf<
					"/a/b" | "/a/c"
				>();
			});
		});

		describe("input constraint", () => {
			test("should reject a prefix without a leading slash at compile time", () => {
				// @ts-expect-error - Prefix must start with '/'
				type _A = MergePaths<"a", "/b">;
			});

			test("should reject a path without a leading slash at compile time", () => {
				// @ts-expect-error - Path must start with '/'
				type _B = MergePaths<"/a", "b">;
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
					MergePaths<"/a/", "/b/">
				>().not.toEqualTypeOf<string>();
			});
		});
	});
});
