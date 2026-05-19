import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";

describe("ExtendsType", () => {
	describe("identical primitive types", () => {
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
	});

	describe("strict subtype relations", () => {
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

	describe("union types (non-distributive)", () => {
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
	});

	describe("tuple and function types", () => {
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

		test("should resolve to true for equal function signatures", () => {
			type Fn = (value: string) => number;

			const check: ExtendsType<ExtendsType<Fn, Fn>, true> = true;

			expect(check).toBe(true);
		});
	});
});
