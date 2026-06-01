import { describe, expectTypeOf, test } from "bun:test";

import type { AssignableTo } from "@/utils/types/assignable-to";

describe("AssignableTo", () => {
	describe("identical primitive types", () => {
		test("should resolve to true for `string` vs `string`", () => {
			expectTypeOf<AssignableTo<string, string>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `number` vs `number`", () => {
			expectTypeOf<AssignableTo<number, number>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `boolean` vs `boolean`", () => {
			expectTypeOf<
				AssignableTo<boolean, boolean>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `null` vs `null`", () => {
			expectTypeOf<AssignableTo<null, null>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `undefined` vs `undefined`", () => {
			expectTypeOf<
				AssignableTo<undefined, undefined>
			>().toEqualTypeOf<true>();
		});
	});

	describe("subtype relations", () => {
		test("should resolve to true when a literal flows into its widening primitive", () => {
			expectTypeOf<AssignableTo<"foo", string>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a narrow numeric literal flows into `number`", () => {
			expectTypeOf<AssignableTo<1, number>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when `true` flows into `boolean`", () => {
			expectTypeOf<AssignableTo<true, boolean>>().toEqualTypeOf<true>();
		});

		test("should resolve to false when a primitive flows into one of its literals", () => {
			expectTypeOf<AssignableTo<string, "foo">>().toEqualTypeOf<false>();
		});

		test("should resolve to false when `boolean` flows into the literal `true`", () => {
			expectTypeOf<AssignableTo<boolean, true>>().toEqualTypeOf<false>();
		});
	});

	describe("union types (non-distributive)", () => {
		test("should resolve to true for two structurally equal unions", () => {
			expectTypeOf<
				AssignableTo<"a" | "b", "a" | "b">
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a single member flows into its union", () => {
			expectTypeOf<AssignableTo<"a", "a" | "b">>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a primitive flows into a union that contains it", () => {
			expectTypeOf<
				AssignableTo<number, number | string>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when the supertype union has an extra member", () => {
			expectTypeOf<
				AssignableTo<"a" | "b", "a" | "b" | "c">
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when the candidate union has an extra member", () => {
			expectTypeOf<
				AssignableTo<"a" | "b" | "c", "a" | "b">
			>().toEqualTypeOf<false>();
		});

		test("should not distribute over a naked union operand", () => {
			expectTypeOf<AssignableTo<"a" | "b", "a">>().toEqualTypeOf<false>();
		});
	});

	describe("object types", () => {
		test("should resolve to true for structurally equal object shapes", () => {
			expectTypeOf<
				AssignableTo<{ a: string }, { a: string }>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when the candidate has extra keys (width subtyping)", () => {
			expectTypeOf<
				AssignableTo<{ a: string; b: number }, { a: string }>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when an optional key is satisfied by the candidate", () => {
			expectTypeOf<
				AssignableTo<{ a: string }, { a?: string }>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when any object shape flows into the empty object", () => {
			expectTypeOf<
				AssignableTo<{ a: string }, NonNullable<unknown>>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when the candidate is missing a required key", () => {
			expectTypeOf<
				AssignableTo<{ a: string }, { a: string; b: number }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when value types differ on the same key", () => {
			expectTypeOf<
				AssignableTo<{ a: string }, { a: number }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when an optional candidate flows into a required key", () => {
			expectTypeOf<
				AssignableTo<{ a?: string }, { a: string }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when the empty object flows into a shape with required keys", () => {
			expectTypeOf<
				AssignableTo<NonNullable<unknown>, { a: string }>
			>().toEqualTypeOf<false>();
		});
	});

	describe("array types", () => {
		test("should resolve to true for equal array element types", () => {
			expectTypeOf<
				AssignableTo<string[], string[]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a narrow element array flows into a widened element union (covariance)", () => {
			expectTypeOf<
				AssignableTo<string[], (string | number)[]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a mutable array flows into its `readonly` form", () => {
			expectTypeOf<
				AssignableTo<string[], readonly string[]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a tuple flows into an array of its element type", () => {
			expectTypeOf<
				AssignableTo<[string], string[]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when a widened element union flows into a narrower element array", () => {
			expectTypeOf<
				AssignableTo<(string | number)[], string[]>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a `readonly` array flows into its mutable form", () => {
			expectTypeOf<
				AssignableTo<readonly string[], string[]>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when an array flows into a same-element tuple", () => {
			expectTypeOf<
				AssignableTo<string[], [string]>
			>().toEqualTypeOf<false>();
		});
	});

	describe("tuple types", () => {
		test("should resolve to true for equal tuple shapes", () => {
			expectTypeOf<
				AssignableTo<[string, number], [string, number]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false for tuples of different length", () => {
			expectTypeOf<
				AssignableTo<[string, number], [string]>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to true when a mutable tuple flows into a readonly tuple", () => {
			expectTypeOf<
				AssignableTo<[string, number], readonly [string, number]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when a readonly tuple flows into a mutable tuple", () => {
			expectTypeOf<
				AssignableTo<readonly [string, number], [string, number]>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to true when a fixed tuple flows into one with an optional trailing element", () => {
			expectTypeOf<
				AssignableTo<[string, number], [string, number?]>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a fixed tuple flows into one with rest elements of the matching type", () => {
			expectTypeOf<
				AssignableTo<[string, number, number], [string, ...number[]]>
			>().toEqualTypeOf<true>();
		});
	});

	describe("function types", () => {
		test("should resolve to true for equal function signatures", () => {
			type A = (value: string) => number;

			expectTypeOf<AssignableTo<A, A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a function returns a subtype of the expected return type", () => {
			type A = () => string;
			type B = () => "foo";

			expectTypeOf<AssignableTo<B, A>>().toEqualTypeOf<true>();
		});

		describe("with parameter contravariance", () => {
			type A = (value: string | number) => void;
			type B = (value: string) => void;

			test("should resolve to true when a function accepts a wider parameter than expected", () => {
				expectTypeOf<AssignableTo<A, B>>().toEqualTypeOf<true>();
			});

			test("should resolve to false when a function accepts a narrower parameter than expected", () => {
				expectTypeOf<AssignableTo<B, A>>().toEqualTypeOf<false>();
			});
		});

		describe("with parameter count variance", () => {
			type A = () => void;
			type B = (value: string) => void;

			test("should resolve to true when a function takes fewer parameters than expected", () => {
				expectTypeOf<AssignableTo<A, B>>().toEqualTypeOf<true>();
			});

			test("should resolve to false when a function takes more parameters than expected", () => {
				expectTypeOf<AssignableTo<B, A>>().toEqualTypeOf<false>();
			});
		});

		test("should resolve to false when parameter types are unrelated", () => {
			type A = (value: string) => void;
			type B = (value: number) => void;

			expectTypeOf<AssignableTo<A, B>>().toEqualTypeOf<false>();
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to true for `any` vs `any`", () => {
			expectTypeOf<AssignableTo<any, any>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `unknown` vs `unknown`", () => {
			expectTypeOf<
				AssignableTo<unknown, unknown>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `never` vs `never`", () => {
			expectTypeOf<AssignableTo<never, never>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for any type flowing into `unknown`", () => {
			expectTypeOf<AssignableTo<string, unknown>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `any` flowing into any type", () => {
			expectTypeOf<AssignableTo<any, string>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `any` flowing into `unknown`", () => {
			expectTypeOf<AssignableTo<any, unknown>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `unknown` flowing into `any`", () => {
			expectTypeOf<AssignableTo<unknown, any>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `never` flowing into any type", () => {
			expectTypeOf<AssignableTo<never, string>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `never` flowing into `any`", () => {
			expectTypeOf<AssignableTo<never, any>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for `never` flowing into `unknown`", () => {
			expectTypeOf<AssignableTo<never, unknown>>().toEqualTypeOf<true>();
		});

		test("should resolve to false when `unknown` flows into a concrete type", () => {
			expectTypeOf<
				AssignableTo<unknown, string>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a concrete type flows into `never`", () => {
			expectTypeOf<AssignableTo<string, never>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when `any` flows into `never` because tuple wrapping suppresses any-distribution", () => {
			expectTypeOf<AssignableTo<any, never>>().toEqualTypeOf<false>();
		});

		test("should resolve to true for `void` vs `void`", () => {
			expectTypeOf<AssignableTo<void, void>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when `undefined` flows into `void`", () => {
			expectTypeOf<AssignableTo<undefined, void>>().toEqualTypeOf<true>();
		});

		test("should resolve to false when a concrete type flows into `void`", () => {
			expectTypeOf<AssignableTo<string, void>>().toEqualTypeOf<false>();
		});
	});

	describe("unrelated shapes", () => {
		test("should resolve to false when comparing `string` and `number`", () => {
			expectTypeOf<AssignableTo<string, number>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing unrelated object shapes", () => {
			expectTypeOf<
				AssignableTo<{ a: string }, { b: number }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when comparing primitive to object", () => {
			expectTypeOf<
				AssignableTo<string, { a: string }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when `null` flows into `undefined`", () => {
			expectTypeOf<
				AssignableTo<null, undefined>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when `undefined` flows into `null`", () => {
			expectTypeOf<
				AssignableTo<undefined, null>
			>().toEqualTypeOf<false>();
		});
	});
});
