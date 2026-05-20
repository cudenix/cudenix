import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";

describe("ExtendsType", () => {
	describe("primitive types", () => {
		test("should resolve to true for `string` vs `string`", () => {
			const check: ExtendsType<ExtendsType<string, string>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `number` vs `number`", () => {
			const check: ExtendsType<ExtendsType<number, number>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `boolean` vs `boolean`", () => {
			const check: ExtendsType<
				ExtendsType<boolean, boolean>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `null` vs `null`", () => {
			const check: ExtendsType<ExtendsType<null, null>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `undefined` vs `undefined`", () => {
			const check: ExtendsType<
				ExtendsType<undefined, undefined>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing a literal to its widening primitive", () => {
			const check: ExtendsType<ExtendsType<"foo", string>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing a primitive to one of its literals", () => {
			const check: ExtendsType<ExtendsType<string, "foo">, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing a narrow numeric literal to `number`", () => {
			const check: ExtendsType<ExtendsType<1, number>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing `true` to `boolean`", () => {
			const check: ExtendsType<ExtendsType<true, boolean>, false> = true;

			expect(check).toBe(true);
		});
	});

	describe("union types", () => {
		test("should resolve to true for two structurally equal unions", () => {
			const check: ExtendsType<
				ExtendsType<"a" | "b", "a" | "b">,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should not distribute over a naked union operand", () => {
			const check: ExtendsType<ExtendsType<"a" | "b", "a">, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when one union has an extra member", () => {
			const check: ExtendsType<
				ExtendsType<"a" | "b", "a" | "b" | "c">,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("object types", () => {
		test("should resolve to true for structurally equal object shapes", () => {
			const check: ExtendsType<
				ExtendsType<{ a: string }, { a: string }>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when the candidate has an extra key", () => {
			const check: ExtendsType<
				ExtendsType<{ a: string; b: number }, { a: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when the candidate is missing a key", () => {
			const check: ExtendsType<
				ExtendsType<{ a: string }, { a: string; b: number }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when value types differ on the same key", () => {
			const check: ExtendsType<
				ExtendsType<{ a: string }, { a: number }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when an optional property differs from a required one", () => {
			const check: ExtendsType<
				ExtendsType<{ a?: string }, { a: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("array types", () => {
		test("should resolve to true for equal array element types", () => {
			const check: ExtendsType<
				ExtendsType<string[], string[]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for arrays of different element types", () => {
			const check: ExtendsType<
				ExtendsType<string[], number[]>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false comparing an array to a same-element tuple", () => {
			const check: ExtendsType<
				ExtendsType<string[], [string]>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false comparing `readonly` and mutable arrays", () => {
			const check: ExtendsType<
				ExtendsType<readonly string[], string[]>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("tuple types", () => {
		test("should resolve to true for equal tuple shapes", () => {
			const check: ExtendsType<
				ExtendsType<[string, number], [string, number]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for tuples of different length", () => {
			const check: ExtendsType<
				ExtendsType<[string, number], [string]>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("function types", () => {
		test("should resolve to true for equal function signatures", () => {
			type Fn = (value: string) => number;

			const check: ExtendsType<ExtendsType<Fn, Fn>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for functions with different parameter types", () => {
			type Left = (value: string) => void;
			type Right = (value: number) => void;

			const check: ExtendsType<ExtendsType<Left, Right>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for functions with different return types", () => {
			type Left = () => string;
			type Right = () => number;

			const check: ExtendsType<ExtendsType<Left, Right>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for functions with different arity", () => {
			type Left = (a: string) => void;
			type Right = (a: string, b: number) => void;

			const check: ExtendsType<ExtendsType<Left, Right>, false> = true;

			expect(check).toBe(true);
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to true for `any` vs `any`", () => {
			const check: ExtendsType<ExtendsType<any, any>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `unknown` vs `unknown`", () => {
			const check: ExtendsType<
				ExtendsType<unknown, unknown>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `never` vs `never`", () => {
			const check: ExtendsType<ExtendsType<never, never>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `any` vs `unknown` due to bidirectional any-compatibility", () => {
			const check: ExtendsType<ExtendsType<any, unknown>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `any` vs a concrete type due to bidirectional any-compatibility", () => {
			const check: ExtendsType<ExtendsType<any, string>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false comparing `unknown` to a concrete type", () => {
			const check: ExtendsType<
				ExtendsType<unknown, string>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false comparing `never` to a concrete type", () => {
			const check: ExtendsType<ExtendsType<never, string>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for `any` vs `never`", () => {
			const check: ExtendsType<ExtendsType<any, never>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `void` vs `void`", () => {
			const check: ExtendsType<ExtendsType<void, void>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false comparing `void` to a concrete type", () => {
			const check: ExtendsType<ExtendsType<void, string>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for `never` vs `unknown`", () => {
			const check: ExtendsType<ExtendsType<never, unknown>, false> = true;

			expect(check).toBe(true);
		});
	});

	describe("cross-category comparisons", () => {
		test("should resolve to false when comparing `string` and `number`", () => {
			const check: ExtendsType<ExtendsType<string, number>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing unrelated object shapes", () => {
			const check: ExtendsType<
				ExtendsType<{ a: string }, { b: number }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing a primitive to an object", () => {
			const check: ExtendsType<
				ExtendsType<string, { a: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing `null` and `undefined`", () => {
			const check: ExtendsType<
				ExtendsType<null, undefined>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});
});
