import { describe, expectTypeOf, it } from "bun:test";

import type { MergePaths } from "@/utils/types/merge-paths";

describe("MergePaths", () => {
	it("should join a prefix and a path, keeping their segment markers", () => {
		expectTypeOf<
			MergePaths<"/a/b", "/:p1/...r1">
		>().toEqualTypeOf<"/a/b/:p1/...r1">();
	});

	it("should return the other operand when one is the root", () => {
		expectTypeOf<MergePaths<"/", "/a">>().toEqualTypeOf<"/a">();
		expectTypeOf<MergePaths<"/a", "/">>().toEqualTypeOf<"/a">();
		expectTypeOf<MergePaths<"/", "/">>().toEqualTypeOf<"/">();
	});

	it("should strip trailing slashes, also next to a root operand", () => {
		expectTypeOf<MergePaths<"/a/", "/b/">>().toEqualTypeOf<"/a/b">();
		expectTypeOf<MergePaths<"/", "/a/">>().toEqualTypeOf<"/a">();
		expectTypeOf<MergePaths<"/a/", "/">>().toEqualTypeOf<"/a">();
	});

	it("should collapse runs of slashes anywhere in either operand", () => {
		expectTypeOf<
			MergePaths<"/a//b", "/c///d">
		>().toEqualTypeOf<"/a/b/c/d">();
		expectTypeOf<MergePaths<"/a///", "///b">>().toEqualTypeOf<"/a/b">();
		expectTypeOf<MergePaths<"/a", "//b">>().toEqualTypeOf<"/a/b">();
	});

	it("should treat an operand made only of slashes as the root", () => {
		expectTypeOf<MergePaths<"//", "/b">>().toEqualTypeOf<"/b">();
		expectTypeOf<MergePaths<"/a", "//">>().toEqualTypeOf<"/a">();
		expectTypeOf<MergePaths<"//", "//">>().toEqualTypeOf<"/">();
	});

	it("should normalize backslashes like slashes", () => {
		expectTypeOf<
			MergePaths<"/a\\b\\", "/\\c\\d">
		>().toEqualTypeOf<"/a/b/c/d">();
		expectTypeOf<MergePaths<"/\\", "/b\\">>().toEqualTypeOf<"/b">();
	});

	it("should distribute over unions on both sides, root members included", () => {
		expectTypeOf<MergePaths<"/" | "/a", "/b" | "/c\\">>().toEqualTypeOf<
			"/a/b" | "/a/c" | "/b" | "/c"
		>();
	});

	it("should keep the root case of an operand that is not a literal", () => {
		expectTypeOf<MergePaths<`/${string}`, "/b">>().toEqualTypeOf<
			"/b" | `/${string}/b`
		>();
		expectTypeOf<MergePaths<"/a", `/${string}`>>().toEqualTypeOf<
			"/a" | `/a/${string}`
		>();
	});

	it("should reject operands without a leading slash", () => {
		// @ts-expect-error - Prefix must start with '/'
		type _A = MergePaths<"a", "/b">;
		// @ts-expect-error - Path must start with '/'
		type _B = MergePaths<"/a", "b">;
	});
});
