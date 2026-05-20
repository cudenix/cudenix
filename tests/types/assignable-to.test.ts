import { describe, expect, test } from "bun:test";

import type { AssignableTo } from "@/types/assignable-to";
import type { ExtendsType } from "@/types/extends-type";

describe("AssignableTo", () => {
	describe("identical primitive types", () => {
		test("should resolve to true for `string` vs `string`", () => {
			const check: ExtendsType<AssignableTo<string, string>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `number` vs `number`", () => {
			const check: ExtendsType<AssignableTo<number, number>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `boolean` vs `boolean`", () => {
			const check: ExtendsType<
				AssignableTo<boolean, boolean>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `null` vs `null`", () => {
			const check: ExtendsType<AssignableTo<null, null>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `undefined` vs `undefined`", () => {
			const check: ExtendsType<
				AssignableTo<undefined, undefined>,
				true
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("subtype relations", () => {
		test("should resolve to true when a literal flows into its widening primitive", () => {
			const check: ExtendsType<AssignableTo<"foo", string>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a narrow numeric literal flows into `number`", () => {
			const check: ExtendsType<AssignableTo<1, number>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when `true` flows into `boolean`", () => {
			const check: ExtendsType<AssignableTo<true, boolean>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a primitive flows into one of its literals", () => {
			const check: ExtendsType<AssignableTo<string, "foo">, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when `boolean` flows into the literal `true`", () => {
			const check: ExtendsType<AssignableTo<boolean, true>, false> = true;

			expect(check).toBe(true);
		});
	});

	describe("union types (non-distributive)", () => {
		test("should resolve to true for two structurally equal unions", () => {
			const check: ExtendsType<
				AssignableTo<"a" | "b", "a" | "b">,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a single member flows into its union", () => {
			const check: ExtendsType<AssignableTo<"a", "a" | "b">, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a primitive flows into a union that contains it (JSDoc example)", () => {
			const check: ExtendsType<
				AssignableTo<number, number | string>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when the supertype union has an extra member", () => {
			const check: ExtendsType<
				AssignableTo<"a" | "b", "a" | "b" | "c">,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when the candidate union has an extra member", () => {
			const check: ExtendsType<
				AssignableTo<"a" | "b" | "c", "a" | "b">,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should not distribute over a naked union operand", () => {
			const check: ExtendsType<
				AssignableTo<"a" | "b", "a">,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("object types", () => {
		test("should resolve to true for structurally equal object shapes", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string }, { a: string }>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when the candidate has extra keys (width subtyping)", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string; b: number }, { a: string }>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when an optional key is satisfied by the candidate", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string }, { a?: string }>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when any object shape flows into the empty object", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string }, NonNullable<unknown>>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when the candidate is missing a required key", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string }, { a: string; b: number }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when value types differ on the same key", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string }, { a: number }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when an optional candidate flows into a required key", () => {
			const check: ExtendsType<
				AssignableTo<{ a?: string }, { a: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when the empty object flows into a shape with required keys", () => {
			const check: ExtendsType<
				AssignableTo<NonNullable<unknown>, { a: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("array types", () => {
		test("should resolve to true for equal array element types", () => {
			const check: ExtendsType<
				AssignableTo<string[], string[]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a narrow element array flows into a widened element union (covariance)", () => {
			const check: ExtendsType<
				AssignableTo<string[], (string | number)[]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a mutable array flows into its `readonly` form", () => {
			const check: ExtendsType<
				AssignableTo<string[], readonly string[]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a tuple flows into an array of its element type", () => {
			const check: ExtendsType<
				AssignableTo<[string], string[]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a widened element union flows into a narrower element array", () => {
			const check: ExtendsType<
				AssignableTo<(string | number)[], string[]>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a `readonly` array flows into its mutable form", () => {
			const check: ExtendsType<
				AssignableTo<readonly string[], string[]>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when an array flows into a same-element tuple", () => {
			const check: ExtendsType<
				AssignableTo<string[], [string]>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("tuple types", () => {
		test("should resolve to true for equal tuple shapes", () => {
			const check: ExtendsType<
				AssignableTo<[string, number], [string, number]>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for tuples of different length", () => {
			const check: ExtendsType<
				AssignableTo<[string, number], [string]>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("function types", () => {
		test("should resolve to true for equal function signatures", () => {
			type Fn = (value: string) => number;

			const check: ExtendsType<AssignableTo<Fn, Fn>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a function returns a subtype of the expected return type", () => {
			type Wide = () => string;
			type Narrow = () => "foo";

			const check: ExtendsType<AssignableTo<Narrow, Wide>, true> = true;

			expect(check).toBe(true);
		});

		describe("with parameter contravariance", () => {
			type Wide = (value: string | number) => void;
			type Narrow = (value: string) => void;

			test("should resolve to true when a function accepts a wider parameter than expected", () => {
				const check: ExtendsType<
					AssignableTo<Wide, Narrow>,
					true
				> = true;

				expect(check).toBe(true);
			});

			test("should resolve to false when a function accepts a narrower parameter than expected", () => {
				const check: ExtendsType<
					AssignableTo<Narrow, Wide>,
					false
				> = true;

				expect(check).toBe(true);
			});
		});

		describe("with parameter count variance", () => {
			type Fewer = () => void;
			type More = (value: string) => void;

			test("should resolve to true when a function takes fewer parameters than expected", () => {
				const check: ExtendsType<
					AssignableTo<Fewer, More>,
					true
				> = true;

				expect(check).toBe(true);
			});

			test("should resolve to false when a function takes more parameters than expected", () => {
				const check: ExtendsType<
					AssignableTo<More, Fewer>,
					false
				> = true;

				expect(check).toBe(true);
			});
		});

		test("should resolve to false when parameter types are unrelated", () => {
			type Left = (value: string) => void;
			type Right = (value: number) => void;

			const check: ExtendsType<AssignableTo<Left, Right>, false> = true;

			expect(check).toBe(true);
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to true for `any` vs `any`", () => {
			const check: ExtendsType<AssignableTo<any, any>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `unknown` vs `unknown`", () => {
			const check: ExtendsType<
				AssignableTo<unknown, unknown>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `never` vs `never`", () => {
			const check: ExtendsType<AssignableTo<never, never>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for any type flowing into `unknown`", () => {
			const check: ExtendsType<
				AssignableTo<string, unknown>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `any` flowing into any type", () => {
			const check: ExtendsType<AssignableTo<any, string>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `any` flowing into `unknown`", () => {
			const check: ExtendsType<AssignableTo<any, unknown>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `unknown` flowing into `any`", () => {
			const check: ExtendsType<AssignableTo<unknown, any>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `never` flowing into any type", () => {
			const check: ExtendsType<AssignableTo<never, string>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `never` flowing into `any`", () => {
			const check: ExtendsType<AssignableTo<never, any>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for `never` flowing into `unknown`", () => {
			const check: ExtendsType<AssignableTo<never, unknown>, true> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when `unknown` flows into a concrete type", () => {
			const check: ExtendsType<
				AssignableTo<unknown, string>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a concrete type flows into `never`", () => {
			const check: ExtendsType<AssignableTo<string, never>, false> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when `any` flows into `never` because tuple wrapping suppresses any-distribution", () => {
			const check: ExtendsType<AssignableTo<any, never>, false> = true;

			expect(check).toBe(true);
		});
	});

	describe("unrelated shapes", () => {
		test("should resolve to false when comparing `string` and `number`", () => {
			const check: ExtendsType<
				AssignableTo<string, number>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing unrelated object shapes", () => {
			const check: ExtendsType<
				AssignableTo<{ a: string }, { b: number }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when comparing primitive to object", () => {
			const check: ExtendsType<
				AssignableTo<string, { a: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when `null` flows into `undefined`", () => {
			const check: ExtendsType<
				AssignableTo<null, undefined>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when `undefined` flows into `null`", () => {
			const check: ExtendsType<
				AssignableTo<undefined, null>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});
});
