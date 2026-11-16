import { describe, expectTypeOf, it } from "bun:test";

import type { RequiredKeys } from "@/utils/types/required-keys";

describe("RequiredKeys", () => {
	it("should resolve to every key when all are required", () => {
		expectTypeOf<RequiredKeys<{ a: string; b: null }>>().toEqualTypeOf<
			"a" | "b"
		>();
	});

	it("should exclude optional keys and keys whose value admits `undefined`", () => {
		interface A {
			a: string;
			b?: string;
			c: number | undefined;
			d: unknown;
		}

		expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"a">();
	});

	it("should resolve to `never` when no key is required", () => {
		expectTypeOf<RequiredKeys<{ a?: string; b: undefined }>>().toBeNever();
		expectTypeOf<RequiredKeys<NonNullable<unknown>>>().toBeNever();
	});

	it("should keep only the required keys common to every member of a union", () => {
		expectTypeOf<
			RequiredKeys<{ a: string; b?: number } | { a: string; c: boolean }>
		>().toEqualTypeOf<"a">();
	});

	it("should reject non-object inputs", () => {
		// @ts-expect-error - string does not satisfy `T extends object`
		type _A = RequiredKeys<string>;
	});
});
