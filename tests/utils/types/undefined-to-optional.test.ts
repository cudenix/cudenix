import { describe, expectTypeOf, it } from "bun:test";

import type { UndefinedToOptional } from "@/utils/types/undefined-to-optional";

describe("UndefinedToOptional", () => {
	it("should make optional only the keys whose value admits `undefined`", () => {
		expectTypeOf<
			UndefinedToOptional<{ a: string; readonly b: number | undefined }>
		>().toEqualTypeOf<
			{ a: string } & { readonly b?: number | undefined }
		>();
	});

	it("should return the type itself when no value admits `undefined`", () => {
		interface A {
			a: string;
			b: null;
		}

		expectTypeOf<UndefinedToOptional<A>>().toEqualTypeOf<A>();
	});

	it("should return `Partial` of the type when every value admits `undefined`", () => {
		interface A {
			a: string | undefined;
			b: unknown;
		}

		expectTypeOf<UndefinedToOptional<A>>().toEqualTypeOf<Partial<A>>();
	});

	it("should keep a key that is already optional optional", () => {
		interface A {
			a: string;
			b?: number;
		}

		expectTypeOf<UndefinedToOptional<A>>().branded.toEqualTypeOf<{
			a: string;
			b?: number;
		}>();
	});

	it("should relax each member of a union on its own keys", () => {
		type A =
			| { a: string; b: number | undefined }
			| { a: string | undefined; c: boolean };

		expectTypeOf<UndefinedToOptional<A>>().branded.toEqualTypeOf<
			| { a: string; b?: number | undefined }
			| { a?: string | undefined; c: boolean }
		>();
	});

	it("should leave tuples and arrays untouched", () => {
		expectTypeOf<
			UndefinedToOptional<[string, number | undefined]>
		>().toEqualTypeOf<[string, number | undefined]>();
		expectTypeOf<
			UndefinedToOptional<readonly (number | undefined)[]>
		>().toEqualTypeOf<readonly (number | undefined)[]>();
	});
});
