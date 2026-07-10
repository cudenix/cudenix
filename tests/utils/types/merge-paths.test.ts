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

	describe("doubled-slash passthrough", () => {
		it("should keep a doubled slash inside the prefix as written", () => {
			expectTypeOf<
				MergePaths<"/a//b", "/c">
			>().toEqualTypeOf<"/a//b/c">();
		});

		it("should keep a doubled slash inside the path as written", () => {
			expectTypeOf<
				MergePaths<"/a", "/b//c">
			>().toEqualTypeOf<"/a/b//c">();
		});

		it("should strip only one slash from a doubled trailing slash on the prefix", () => {
			expectTypeOf<MergePaths<"/a//", "/b">>().toEqualTypeOf<"/a//b">();
		});

		it("should strip only one slash from a doubled trailing slash on the path", () => {
			expectTypeOf<MergePaths<"/a", "/b//">>().toEqualTypeOf<"/a/b/">();
		});

		it("should keep the doubled slash of a slashes-only prefix", () => {
			expectTypeOf<MergePaths<"//", "/b">>().toEqualTypeOf<"//b">();
		});

		it("should reduce a slashes-only path to a trailing slash on the prefix", () => {
			expectTypeOf<MergePaths<"/a", "//">>().toEqualTypeOf<"/a/">();
		});

		it("should reduce a slashes-only path to root when the prefix is root", () => {
			expectTypeOf<MergePaths<"/", "//">>().toEqualTypeOf<"/">();
		});

		it("should collapse a slashes-only prefix to root when the path is root - the only case a `//` prefix collapses", () => {
			expectTypeOf<MergePaths<"//", "/">>().toEqualTypeOf<"/">();
		});
	});

	describe("non-literal inputs", () => {
		it("should join a non-literal prefix with a literal path", () => {
			expectTypeOf<
				MergePaths<`/${string}`, "/b">
			>().toEqualTypeOf<`/${string}/b`>();
		});

		it("should join a literal prefix with a non-literal path", () => {
			expectTypeOf<
				MergePaths<"/a", `/${string}`>
			>().toEqualTypeOf<`/a/${string}`>();
		});

		it("should strip a trailing slash from a non-literal prefix", () => {
			expectTypeOf<
				MergePaths<`/${string}/`, "/b">
			>().toEqualTypeOf<`/${string}/b`>();
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

			it("should distribute over a path union containing the root", () => {
				expectTypeOf<MergePaths<"/a", "/b" | "/">>().toEqualTypeOf<
					"/a/b" | "/a"
				>();
			});

			it("should distribute over a prefix union containing the root", () => {
				expectTypeOf<MergePaths<"/" | "/a", "/b">>().toEqualTypeOf<
					"/b" | "/a/b"
				>();
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
