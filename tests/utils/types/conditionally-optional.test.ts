import { describe, expectTypeOf, it } from "bun:test";

import type { ConditionallyOptional } from "@/utils/types/conditionally-optional";

describe("ConditionallyOptional", () => {
	it("should make optional only the keys whose value admits the marker", () => {
		expectTypeOf<
			ConditionallyOptional<
				{ a: string; readonly b: number | undefined },
				undefined
			>
		>().toEqualTypeOf<
			{ a: string } & { readonly b?: number | undefined }
		>();
	});

	it("should return the type itself when no value admits the marker", () => {
		interface A {
			a: string;
			b?: number;
		}

		expectTypeOf<ConditionallyOptional<A, null>>().toEqualTypeOf<A>();
	});

	it("should return `Partial` of the type when every value admits the marker", () => {
		interface A {
			a: string | undefined;
			b: unknown;
		}

		expectTypeOf<ConditionallyOptional<A, undefined>>().toEqualTypeOf<
			Partial<A>
		>();
	});

	it("should make a key optional when its value admits any member of a union marker", () => {
		interface A {
			a: null | string;
			b: boolean;
			c: number | undefined;
		}

		expectTypeOf<
			ConditionallyOptional<A, null | undefined>
		>().branded.toEqualTypeOf<{
			a?: null | string;
			b: boolean;
			c?: number | undefined;
		}>();
	});

	it("should relax each member of a union on its own keys", () => {
		type A =
			| { a: string; b: number | undefined }
			| { a: string | undefined; c: boolean };

		expectTypeOf<
			ConditionallyOptional<A, undefined>
		>().branded.toEqualTypeOf<
			| { a: string; b?: number | undefined }
			| { a?: string | undefined; c: boolean }
		>();
	});

	it("should leave tuples and arrays untouched", () => {
		expectTypeOf<
			ConditionallyOptional<[string, number | undefined], undefined>
		>().toEqualTypeOf<[string, number | undefined]>();
		expectTypeOf<
			ConditionallyOptional<readonly (number | undefined)[], undefined>
		>().toEqualTypeOf<readonly (number | undefined)[]>();
	});
});
