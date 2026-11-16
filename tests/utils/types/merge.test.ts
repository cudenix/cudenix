import { describe, expectTypeOf, it } from "bun:test";

import type { Merge } from "@/utils/types/merge";

describe("Merge", () => {
	describe("plain keys", () => {
		it("should resolve to the kept properties intersected with the incoming ones", () => {
			expectTypeOf<
				Merge<{ a: string; b: number }, { b: boolean; c: string }>
			>().toEqualTypeOf<{ a: string } & { b: boolean; c: string }>();
		});

		it("should take the modifiers of whichever operand a key comes from", () => {
			interface A {
				readonly a: string;
				b?: number;
				readonly c: string;
			}
			interface B {
				c: number;
				readonly d: string;
				e?: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				readonly a: string;
				b?: number;
				c: number;
				readonly d: string;
				e?: number;
			}>();
		});

		it("should merge again on top of its own output", () => {
			type A = Merge<{ a: string; c: string }, { b: number; c: number }>;

			expectTypeOf<
				Merge<A, { a: boolean; b?: string }>
			>().branded.toEqualTypeOf<{
				a: boolean;
				b: number | string | undefined;
				c: number;
			}>();
		});
	});

	describe("optional overrides", () => {
		it("should union an optional override with the base value and keep the base modifiers", () => {
			expectTypeOf<
				Merge<{ readonly a: string }, { a?: number }>
			>().branded.toEqualTypeOf<{
				readonly a: number | string | undefined;
			}>();
		});

		it("should stay optional when both operands declare the key optional", () => {
			expectTypeOf<
				Merge<{ a?: string }, { a?: number }>
			>().branded.toEqualTypeOf<{ a?: number | string }>();
		});

		it("should become required when the override is required", () => {
			expectTypeOf<
				Merge<{ a?: string }, { a: number | undefined }>
			>().branded.toEqualTypeOf<{ a: number | undefined }>();
		});
	});

	describe("numeric keys", () => {
		it("should replace a key with its other spelling", () => {
			expectTypeOf<
				Merge<{ 0: string }, { "0": number }>
			>().branded.toEqualTypeOf<{ "0": number }>();
			expectTypeOf<
				Merge<{ "0": string }, { 0: number }>
			>().branded.toEqualTypeOf<{ 0: number }>();
		});

		it("should union an optional override written in the other spelling", () => {
			expectTypeOf<
				Merge<{ readonly 0: string }, { "0"?: number }>
			>().branded.toEqualTypeOf<{
				readonly 0: number | string | undefined;
			}>();
			expectTypeOf<
				Merge<{ readonly "0": string }, { 0?: number }>
			>().branded.toEqualTypeOf<{
				readonly "0": number | string | undefined;
			}>();
		});

		it("should keep a numeric string that is not canonical as a distinct key", () => {
			expectTypeOf<
				Merge<{ 1: string }, { "01": number }>
			>().branded.toEqualTypeOf<{ "01": number; 1: string }>();
			expectTypeOf<
				Merge<{ "01": string }, { 1?: number }>
			>().branded.toEqualTypeOf<{ "01": string; 1?: number }>();
		});
	});

	describe("symbol keys", () => {
		it("should keep the symbols of the first operand and drop those of the second", () => {
			const sym = Symbol("a");
			const other = Symbol("b");

			interface A {
				a: string;
				[sym]: string;
			}
			interface B {
				a: number;
				[other]: number;
				[sym]: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<
				{ a: number } & Record<typeof sym, string>
			>();
		});
	});

	describe("index signatures", () => {
		it("should replace a key of the first operand's index and widen the index to admit it", () => {
			type A = Merge<Record<string, number>, { a: string }>;

			expectTypeOf<A["a"]>().toEqualTypeOf<string>();
			expectTypeOf<A[string]>().toEqualTypeOf<number | string>();
		});

		it("should keep an optional override optional and union it with the first operand's index", () => {
			type A = Merge<Record<string, number>, { a?: string }>;

			expectTypeOf<Pick<A, "a">>().toEqualTypeOf<{
				a?: number | string;
			}>();
			expectTypeOf<A[string]>().toEqualTypeOf<
				number | string | undefined
			>();
		});

		it("should union a declared key with the second operand's index, in both directions", () => {
			type A = Merge<{ a: string }, Record<string, number>>;

			expectTypeOf<A["a"]>().toEqualTypeOf<number | string>();
			expectTypeOf<A["b"]>().toEqualTypeOf<number | string>();
		});

		it("should match a numeric index against a key spelled as a string", () => {
			type A = Merge<Record<number, number>, { "0": string }>;

			expectTypeOf<A[0]>().toEqualTypeOf<string>();
			expectTypeOf<A[number]>().toEqualTypeOf<number | string>();
		});

		it("should widen only the template pattern that an override matches", () => {
			type A = Merge<
				Record<`x-${string}`, number> & Record<`y-${string}`, boolean>,
				{ "x-a": string }
			>;

			expectTypeOf<A["x-a"]>().toEqualTypeOf<string>();
			expectTypeOf<A[`x-${string}`]>().toEqualTypeOf<number | string>();
			expectTypeOf<A[`y-${string}`]>().toEqualTypeOf<boolean>();
		});
	});

	describe("unions", () => {
		it("should distribute over the second operand", () => {
			expectTypeOf<
				Merge<{ a: string }, { a: number } | { b: number }>
			>().branded.toEqualTypeOf<
				{ a: number } | { a: string; b: number }
			>();
		});

		it("should distribute over the first operand", () => {
			expectTypeOf<
				Merge<{ a: string } | { b: string }, { c: boolean }>
			>().branded.toEqualTypeOf<
				{ a: string; c: boolean } | { b: string; c: boolean }
			>();
		});
	});

	it("should reject operands that are not objects", () => {
		// @ts-expect-error - string does not satisfy `T extends object`
		type _A = Merge<string, { a: string }>;
		// @ts-expect-error - number does not satisfy `U extends object`
		type _B = Merge<{ a: string }, number>;
	});
});
