import { describe, expectTypeOf, it } from "bun:test";

import type { ExtendsType } from "@/utils/types/extends-type";

describe("ExtendsType", () => {
	describe("primitive types", () => {
		it("should resolve to true for `string` vs `string`", () => {
			expectTypeOf<ExtendsType<string, string>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `number` vs `number`", () => {
			expectTypeOf<ExtendsType<number, number>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `boolean` vs `boolean`", () => {
			expectTypeOf<ExtendsType<boolean, boolean>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `null` vs `null`", () => {
			expectTypeOf<ExtendsType<null, null>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `undefined` vs `undefined`", () => {
			expectTypeOf<
				ExtendsType<undefined, undefined>
			>().toEqualTypeOf<true>();
		});

		it("should resolve to false when comparing a literal to its widening primitive", () => {
			expectTypeOf<ExtendsType<"a", string>>().toEqualTypeOf<false>();
		});

		it("should resolve to false when comparing a primitive to one of its literals", () => {
			expectTypeOf<ExtendsType<string, "a">>().toEqualTypeOf<false>();
		});

		it("should resolve to false when comparing a narrow numeric literal to `number`", () => {
			expectTypeOf<ExtendsType<1, number>>().toEqualTypeOf<false>();
		});

		it("should resolve to false when comparing `true` to `boolean`", () => {
			expectTypeOf<ExtendsType<true, boolean>>().toEqualTypeOf<false>();
		});
	});

	describe("union types", () => {
		it("should resolve to true for two structurally equal unions", () => {
			expectTypeOf<
				ExtendsType<"a" | "b", "a" | "b">
			>().toEqualTypeOf<true>();
		});

		it("should not distribute over a naked union operand", () => {
			expectTypeOf<ExtendsType<"a" | "b", "a">>().toEqualTypeOf<false>();
		});

		it("should resolve to false when one union has an extra member", () => {
			expectTypeOf<
				ExtendsType<"a" | "b", "a" | "b" | "c">
			>().toEqualTypeOf<false>();
		});
	});

	describe("object types", () => {
		it("should resolve to true for structurally equal object shapes", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: string }>
			>().toEqualTypeOf<true>();
		});

		it("should resolve to false when the candidate has an extra key", () => {
			expectTypeOf<
				ExtendsType<{ a: string; b: number }, { a: string }>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false when the candidate is missing a key", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: string; b: number }>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false when value types differ on the same key", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: number }>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false when an optional property differs from a required one", () => {
			expectTypeOf<
				ExtendsType<{ a?: string }, { a: string }>
			>().toEqualTypeOf<false>();
		});
	});

	describe("array types", () => {
		it("should resolve to true for equal array element types", () => {
			expectTypeOf<
				ExtendsType<string[], string[]>
			>().toEqualTypeOf<true>();
		});

		it("should resolve to false for arrays of different element types", () => {
			expectTypeOf<
				ExtendsType<string[], number[]>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false comparing an array to a same-element tuple", () => {
			expectTypeOf<
				ExtendsType<string[], [string]>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false comparing `readonly` and mutable arrays", () => {
			expectTypeOf<
				ExtendsType<readonly string[], string[]>
			>().toEqualTypeOf<false>();
		});
	});

	describe("tuple types", () => {
		it("should resolve to true for equal tuple shapes", () => {
			expectTypeOf<
				ExtendsType<[string, number], [string, number]>
			>().toEqualTypeOf<true>();
		});

		it("should resolve to false for tuples of different length", () => {
			expectTypeOf<
				ExtendsType<[string, number], [string]>
			>().toEqualTypeOf<false>();
		});
	});

	describe("function types", () => {
		it("should resolve to true for equal function signatures", () => {
			type A = (value: string) => number;

			expectTypeOf<ExtendsType<A, A>>().toEqualTypeOf<true>();
		});

		it("should resolve to false for functions with different parameter types", () => {
			type A = (value: string) => void;
			type B = (value: number) => void;

			expectTypeOf<ExtendsType<A, B>>().toEqualTypeOf<false>();
		});

		it("should resolve to false for functions with different return types", () => {
			type A = () => string;
			type B = () => number;

			expectTypeOf<ExtendsType<A, B>>().toEqualTypeOf<false>();
		});

		it("should resolve to false for functions with different arity", () => {
			type A = (a: string) => void;
			type B = (a: string, b: number) => void;

			expectTypeOf<ExtendsType<A, B>>().toEqualTypeOf<false>();
		});
	});

	describe("top, bottom and exotic types", () => {
		it("should resolve to true for `any` vs `any`", () => {
			expectTypeOf<ExtendsType<any, any>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `unknown` vs `unknown`", () => {
			expectTypeOf<ExtendsType<unknown, unknown>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `never` vs `never`", () => {
			expectTypeOf<ExtendsType<never, never>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `any` vs `unknown` due to bidirectional any-compatibility", () => {
			expectTypeOf<ExtendsType<any, unknown>>().toEqualTypeOf<true>();
		});

		it("should resolve to true for `any` vs a concrete type due to bidirectional any-compatibility", () => {
			expectTypeOf<ExtendsType<any, string>>().toEqualTypeOf<true>();
		});

		it("should resolve to false comparing `unknown` to a concrete type", () => {
			expectTypeOf<ExtendsType<unknown, string>>().toEqualTypeOf<false>();
		});

		it("should resolve to false comparing `never` to a concrete type", () => {
			expectTypeOf<ExtendsType<never, string>>().toEqualTypeOf<false>();
		});

		it("should resolve to false for `any` vs `never`", () => {
			expectTypeOf<ExtendsType<any, never>>().toEqualTypeOf<false>();
		});

		it("should resolve to true for a concrete type vs `any` due to bidirectional any-compatibility", () => {
			expectTypeOf<ExtendsType<string, any>>().toEqualTypeOf<true>();
		});

		it("should resolve to false for `never` vs `any`", () => {
			expectTypeOf<ExtendsType<never, any>>().toEqualTypeOf<false>();
		});

		it("should resolve to true for `void` vs `void`", () => {
			expectTypeOf<ExtendsType<void, void>>().toEqualTypeOf<true>();
		});

		it("should resolve to false comparing `void` to a concrete type", () => {
			expectTypeOf<ExtendsType<void, string>>().toEqualTypeOf<false>();
		});

		it("should resolve to false for `never` vs `unknown`", () => {
			expectTypeOf<ExtendsType<never, unknown>>().toEqualTypeOf<false>();
		});
	});

	describe("symmetry", () => {
		it("should yield the same result regardless of argument order for unrelated primitives", () => {
			expectTypeOf<ExtendsType<string, number>>().toEqualTypeOf<
				ExtendsType<number, string>
			>();
		});

		it("should yield the same result regardless of argument order for one-way subtype pairs", () => {
			expectTypeOf<ExtendsType<"a", string>>().toEqualTypeOf<
				ExtendsType<string, "a">
			>();
		});

		it("should yield the same result regardless of argument order for one-way width-subtype object shapes", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: string; b: number }>
			>().toEqualTypeOf<
				ExtendsType<{ a: string; b: number }, { a: string }>
			>();
		});
	});

	describe("cross-category comparisons", () => {
		it("should resolve to false when comparing `string` and `number`", () => {
			expectTypeOf<ExtendsType<string, number>>().toEqualTypeOf<false>();
		});

		it("should resolve to false when comparing unrelated object shapes", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { b: number }>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false when comparing a primitive to an object", () => {
			expectTypeOf<
				ExtendsType<string, { a: string }>
			>().toEqualTypeOf<false>();
		});

		it("should resolve to false when comparing `null` and `undefined`", () => {
			expectTypeOf<ExtendsType<null, undefined>>().toEqualTypeOf<false>();
		});
	});
});
