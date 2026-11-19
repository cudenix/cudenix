import { describe, expectTypeOf, it } from "bun:test";

import type { NonUndefinedKeys } from "@/utils/types/non-undefined-keys";

describe("NonUndefinedKeys", () => {
	it("should resolve to every key when no value admits `undefined`", () => {
		expectTypeOf<NonUndefinedKeys<{ a: string; b: null }>>().toEqualTypeOf<
			"a" | "b"
		>();
	});

	it("should exclude optional keys and required keys whose value admits `undefined`", () => {
		interface A {
			a: string;
			b?: string;
			c: number | undefined;
			d: unknown;
		}

		expectTypeOf<NonUndefinedKeys<A>>().toEqualTypeOf<"a">();
	});

	it("should resolve to `never` when every value admits `undefined`", () => {
		expectTypeOf<
			NonUndefinedKeys<{ a?: string; b: undefined }>
		>().toBeNever();
		expectTypeOf<NonUndefinedKeys<NonNullable<unknown>>>().toBeNever();
	});

	it("should keep only the keys common to every member of a union", () => {
		expectTypeOf<
			NonUndefinedKeys<
				{ a: string; b?: number } | { a: string; c: boolean }
			>
		>().toEqualTypeOf<"a">();
	});

	it("should reject non-object inputs", () => {
		// @ts-expect-error - string does not satisfy `T extends object`
		type _A = NonUndefinedKeys<string>;
	});
});
