import { describe, expectTypeOf, it } from "bun:test";

import type { MergePaths } from "@/utils/types/merge-paths";

describe("MergePaths", () => {
	describe("typical concatenation", () => {
		it("should join a non-root prefix with a non-root path", () => {
			expectTypeOf<MergePaths<"/a", "/b">>().toEqualTypeOf<"/a/b">();
		});

		it("should join a multi-segment prefix with a multi-segment path", () => {
			expectTypeOf<
				MergePaths<"/a/b", "/c/d">
			>().toEqualTypeOf<"/a/b/c/d">();
		});

		it("should preserve dynamic-segment markers in the joined string", () => {
			expectTypeOf<
				MergePaths<"/a", "/b/:p1">
			>().toEqualTypeOf<"/a/b/:p1">();
		});

		it("should preserve rest-segment markers in the joined string", () => {
			expectTypeOf<
				MergePaths<"/a", "/...r1">
			>().toEqualTypeOf<"/a/...r1">();
		});

		it("should preserve a wildcard marker in the joined string", () => {
			expectTypeOf<MergePaths<"/a", "/*">>().toEqualTypeOf<"/a/*">();
		});
	});

	describe("root-path handling", () => {
		it("should collapse a root prefix to the path itself", () => {
			expectTypeOf<MergePaths<"/", "/a">>().toEqualTypeOf<"/a">();
		});

		it("should collapse a root path to the prefix itself", () => {
			expectTypeOf<MergePaths<"/a", "/">>().toEqualTypeOf<"/a">();
		});

		it("should resolve `/` + `/` to `/`", () => {
			expectTypeOf<MergePaths<"/", "/">>().toEqualTypeOf<"/">();
		});
	});

	describe("trailing-slash normalization", () => {
		describe("on a single side", () => {
			it("should strip a trailing slash from the prefix", () => {
				expectTypeOf<MergePaths<"/a/", "/b">>().toEqualTypeOf<"/a/b">();
			});

			it("should strip a trailing slash from the path", () => {
				expectTypeOf<MergePaths<"/a", "/b/">>().toEqualTypeOf<"/a/b">();
			});
		});

		describe("on both sides", () => {
			it("should strip a trailing slash from both sides", () => {
				expectTypeOf<
					MergePaths<"/a/", "/b/">
				>().toEqualTypeOf<"/a/b">();
			});
		});

		describe("combined with root handling", () => {
			it("should strip a trailing slash from the path when the prefix is root", () => {
				expectTypeOf<MergePaths<"/", "/a/">>().toEqualTypeOf<"/a">();
			});

			it("should strip a trailing slash from the prefix when the path is root", () => {
				expectTypeOf<MergePaths<"/a/", "/">>().toEqualTypeOf<"/a">();
			});
		});

		describe("combined with dynamic segments", () => {
			it("should strip a trailing slash while preserving a param segment", () => {
				expectTypeOf<
					MergePaths<"/a/", "/b/:p1/">
				>().toEqualTypeOf<"/a/b/:p1">();
			});

			it("should strip a trailing slash while preserving a rest segment", () => {
				expectTypeOf<
					MergePaths<"/a", "/...r1/">
				>().toEqualTypeOf<"/a/...r1">();
			});
		});
	});

	describe("structural relations", () => {
		describe("union distribution", () => {
			it("should distribute over a union of prefixes", () => {
				expectTypeOf<MergePaths<"/a" | "/b", "/c">>().toEqualTypeOf<
					"/a/c" | "/b/c"
				>();
			});

			it("should distribute over a union of paths", () => {
				expectTypeOf<MergePaths<"/a", "/b" | "/c">>().toEqualTypeOf<
					"/a/b" | "/a/c"
				>();
			});

			it("should distribute pairwise over a union on both sides", () => {
				expectTypeOf<
					MergePaths<"/a" | "/b", "/c" | "/d">
				>().toEqualTypeOf<"/a/c" | "/a/d" | "/b/c" | "/b/d">();
			});
		});

		describe("input constraint", () => {
			it("should reject a prefix without a leading slash at compile time", () => {
				// @ts-expect-error - Prefix must start with '/'
				type _A = MergePaths<"a", "/b">;
			});

			it("should reject a path without a leading slash at compile time", () => {
				// @ts-expect-error - Path must start with '/'
				type _B = MergePaths<"/a", "b">;
			});
		});

		describe("literal-type preservation", () => {
			it("should produce a string-literal type, not a widened `string`", () => {
				expectTypeOf<
					MergePaths<"/a", "/b">
				>().not.toEqualTypeOf<string>();
			});

			it("should preserve literal-ness when both sides carry trailing slashes", () => {
				expectTypeOf<
					MergePaths<"/a/", "/b/">
				>().not.toEqualTypeOf<string>();
			});
		});
	});
});
