import { describe, expectTypeOf, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";

describe("ExtendsType", () => {
	describe("primitive types", () => {
		test("should resolve to true for `string` vs `string`", () => {
			expectTypeOf<ExtendsType<string, string>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `number` vs `number`", () => {
			expectTypeOf<ExtendsType<number, number>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `boolean` vs `boolean`", () => {
			expectTypeOf<ExtendsType<boolean, boolean>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `null` vs `null`", () => {
			expectTypeOf<ExtendsType<null, null>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `undefined` vs `undefined`", () => {
			expectTypeOf<
				ExtendsType<undefined, undefined>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when comparing a literal to its widening primitive", () => {
			expectTypeOf<ExtendsType<"foo", string>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing a primitive to one of its literals", () => {
			expectTypeOf<ExtendsType<string, "foo">>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing a narrow numeric literal to `number`", () => {
			expectTypeOf<ExtendsType<1, number>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing `true` to `boolean`", () => {
			expectTypeOf<ExtendsType<true, boolean>>().toEqualTypeOf<false>();
		});
	});

	describe("union types", () => {
		test("should resolve to true for two structurally equal unions", () => {
			expectTypeOf<
				ExtendsType<"a" | "b", "a" | "b">
			>().toEqualTypeOf<true>();
		});

		test("should not distribute over a naked union operand", () => {
			expectTypeOf<ExtendsType<"a" | "b", "a">>().toEqualTypeOf<false>();
		});

		test("should resolve to false when one union has an extra member", () => {
			expectTypeOf<
				ExtendsType<"a" | "b", "a" | "b" | "c">
			>().toEqualTypeOf<false>();
		});
	});

	describe("object types", () => {
		test("should resolve to true for structurally equal object shapes", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: string }>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when the candidate has an extra key", () => {
			expectTypeOf<
				ExtendsType<{ a: string; b: number }, { a: string }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when the candidate is missing a key", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: string; b: number }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when value types differ on the same key", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: number }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when an optional property differs from a required one", () => {
			expectTypeOf<
				ExtendsType<{ a?: string }, { a: string }>
			>().toEqualTypeOf<false>();
		});
	});

	describe("array types", () => {
		test("should resolve to true for equal array element types", () => {
			expectTypeOf<
				ExtendsType<string[], string[]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false for arrays of different element types", () => {
			expectTypeOf<
				ExtendsType<string[], number[]>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false comparing an array to a same-element tuple", () => {
			expectTypeOf<
				ExtendsType<string[], [string]>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false comparing `readonly` and mutable arrays", () => {
			expectTypeOf<
				ExtendsType<readonly string[], string[]>
			>().toEqualTypeOf<false>();
		});
	});

	describe("tuple types", () => {
		test("should resolve to true for equal tuple shapes", () => {
			expectTypeOf<
				ExtendsType<[string, number], [string, number]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false for tuples of different length", () => {
			expectTypeOf<
				ExtendsType<[string, number], [string]>
			>().toEqualTypeOf<false>();
		});
	});

	describe("function types", () => {
		test("should resolve to true for equal function signatures", () => {
			type Fn = (value: string) => number;

			expectTypeOf<ExtendsType<Fn, Fn>>().toEqualTypeOf<true>();
		});

		test("should resolve to false for functions with different parameter types", () => {
			type Left = (value: string) => void;
			type Right = (value: number) => void;

			expectTypeOf<ExtendsType<Left, Right>>().toEqualTypeOf<false>();
		});

		test("should resolve to false for functions with different return types", () => {
			type Left = () => string;
			type Right = () => number;

			expectTypeOf<ExtendsType<Left, Right>>().toEqualTypeOf<false>();
		});

		test("should resolve to false for functions with different arity", () => {
			type Left = (a: string) => void;
			type Right = (a: string, b: number) => void;

			expectTypeOf<ExtendsType<Left, Right>>().toEqualTypeOf<false>();
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to true for `any` vs `any`", () => {
			expectTypeOf<ExtendsType<any, any>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `unknown` vs `unknown`", () => {
			expectTypeOf<ExtendsType<unknown, unknown>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `never` vs `never`", () => {
			expectTypeOf<ExtendsType<never, never>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `any` vs `unknown` due to bidirectional any-compatibility", () => {
			expectTypeOf<ExtendsType<any, unknown>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `any` vs a concrete type due to bidirectional any-compatibility", () => {
			expectTypeOf<ExtendsType<any, string>>().toEqualTypeOf<true>();
		});

		test("should resolve to false comparing `unknown` to a concrete type", () => {
			expectTypeOf<ExtendsType<unknown, string>>().toEqualTypeOf<false>();
		});

		test("should resolve to false comparing `never` to a concrete type", () => {
			expectTypeOf<ExtendsType<never, string>>().toEqualTypeOf<false>();
		});

		test("should resolve to false for `any` vs `never`", () => {
			expectTypeOf<ExtendsType<any, never>>().toEqualTypeOf<false>();
		});

		test("should resolve to true for `void` vs `void`", () => {
			expectTypeOf<ExtendsType<void, void>>().toEqualTypeOf<true>();
		});

		test("should resolve to false comparing `void` to a concrete type", () => {
			expectTypeOf<ExtendsType<void, string>>().toEqualTypeOf<false>();
		});

		test("should resolve to false for `never` vs `unknown`", () => {
			expectTypeOf<ExtendsType<never, unknown>>().toEqualTypeOf<false>();
		});
	});

	describe("symmetry", () => {
		test("should yield the same result regardless of argument order for unrelated primitives", () => {
			expectTypeOf<ExtendsType<string, number>>().toEqualTypeOf<
				ExtendsType<number, string>
			>();
		});

		test("should yield the same result regardless of argument order for one-way subtype pairs", () => {
			expectTypeOf<ExtendsType<"foo", string>>().toEqualTypeOf<
				ExtendsType<string, "foo">
			>();
		});

		test("should yield the same result regardless of argument order for one-way width-subtype object shapes", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { a: string; b: number }>
			>().toEqualTypeOf<
				ExtendsType<{ a: string; b: number }, { a: string }>
			>();
		});
	});

	describe("cross-category comparisons", () => {
		test("should resolve to false when comparing `string` and `number`", () => {
			expectTypeOf<ExtendsType<string, number>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing unrelated object shapes", () => {
			expectTypeOf<
				ExtendsType<{ a: string }, { b: number }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing a primitive to an object", () => {
			expectTypeOf<
				ExtendsType<string, { a: string }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing `null` and `undefined`", () => {
			expectTypeOf<ExtendsType<null, undefined>>().toEqualTypeOf<false>();
		});
	});
});
