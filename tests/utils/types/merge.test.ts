import { describe, expectTypeOf, it } from "bun:test";

import type { Merge } from "@/utils/types/merge";

describe("Merge", () => {
	describe("with empty operands", () => {
		type Empty = NonNullable<unknown>;

		it("should resolve to an empty object when both operands are empty", () => {
			expectTypeOf<Merge<Empty, Empty>>().branded.toEqualTypeOf<Empty>();
		});

		it("should be a no-op when the second operand is empty", () => {
			interface A {
				a: 1;
				b: 2;
			}

			expectTypeOf<Merge<A, Empty>>().branded.toEqualTypeOf<{
				a: 1;
				b: 2;
			}>();
		});

		it("should resolve to the second operand when the first is empty", () => {
			interface B {
				a: 1;
				b: 2;
			}

			expectTypeOf<Merge<Empty, B>>().branded.toEqualTypeOf<{
				a: 1;
				b: 2;
			}>();
		});
	});

	describe("with disjoint keys", () => {
		it("should preserve keys present only in the first operand", () => {
			interface A {
				a: number;
			}
			interface B {
				b: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: number;
				b: string;
			}>();
		});

		it("should include keys present only in the second operand", () => {
			interface A {
				a: string;
			}
			interface B {
				b: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});

		it("should preserve the first operand's `readonly` and `?` modifiers on a disjoint key", () => {
			interface A {
				readonly a: string;
				b?: number;
			}
			interface B {
				c: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				readonly a: string;
				b?: number;
				c: string;
			}>();
		});
	});

	describe("with overlapping keys", () => {
		it("should let the second operand override a key declared in the first", () => {
			interface A {
				a: string[];
			}
			interface B {
				a: readonly string[];
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: readonly string[];
			}>();
		});

		it("should let the second operand replace the value type entirely", () => {
			interface A {
				a: string;
			}
			interface B {
				a: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a: number }>();
		});

		it("should let the second operand narrow a wide value type", () => {
			interface A {
				a: string;
			}
			interface B {
				a: "v1" | "v2";
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: "v1" | "v2";
			}>();
		});

		it("should let the second operand broaden a narrow value type", () => {
			interface A {
				a: "v1";
			}
			interface B {
				a: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a: string }>();
		});

		it("should replace wholesale when the second operand's value includes `undefined` but the key is required", () => {
			interface A {
				a: string;
			}
			interface B {
				a: number | undefined;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: number | undefined;
			}>();
		});
	});

	describe("with overlapping and disjoint keys combined", () => {
		it("should mix overridden, first-only and second-only keys correctly", () => {
			interface A {
				a: 1;
				b: string;
				c: string[];
			}
			interface B {
				c: readonly string[];
				d: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: 1;
				b: string;
				c: readonly string[];
				d: number;
			}>();
		});

		it("should match the documented example of overriding a shared key and carrying a disjoint one", () => {
			interface A {
				a: string;
				b: number;
			}
			interface B {
				b: boolean;
				c: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: string;
				b: boolean;
				c: string;
			}>();
		});
	});

	describe("union operands", () => {
		it("should distribute over a union in the second operand instead of intersecting the branches", () => {
			interface A {
				a: string;
			}
			interface B1 {
				a: number;
			}
			interface B2 {
				b: number;
			}

			expectTypeOf<Merge<A, B1 | B2>>().branded.toEqualTypeOf<
				{ a: number } | { a: string; b: number }
			>();
		});

		it("should keep an overwritten key honest across union branches that do not all declare it", () => {
			interface A {
				a: string;
			}
			interface B1 {
				a: number;
			}
			interface B2 {
				b: number;
			}

			expectTypeOf<Merge<A, B1 | B2>["a"]>().toEqualTypeOf<
				string | number
			>();
		});

		it("should distribute over a union in the first operand", () => {
			interface A1 {
				a: string;
			}
			interface A2 {
				b: string;
			}
			interface B {
				c: 1;
			}

			expectTypeOf<Merge<A1 | A2, B>>().branded.toEqualTypeOf<
				{ a: string; c: 1 } | { b: string; c: 1 }
			>();
		});

		it("should resolve an empty union branch to the first operand alone", () => {
			interface A {
				a: string;
			}
			interface B {
				a: number;
			}

			expectTypeOf<
				Merge<A, B | NonNullable<unknown>>
			>().branded.toEqualTypeOf<{ a: number } | { a: string }>();
		});

		it("should distribute pairwise when both operands are unions", () => {
			interface A1 {
				a: 1;
			}
			interface A2 {
				b: 2;
			}
			interface B1 {
				c: 3;
			}
			interface B2 {
				d: 4;
			}

			expectTypeOf<Merge<A1 | A2, B1 | B2>>().branded.toEqualTypeOf<
				| { a: 1; c: 3 }
				| { a: 1; d: 4 }
				| { b: 2; c: 3 }
				| { b: 2; d: 4 }
			>();
		});
	});

	describe("never operands", () => {
		it("should collapse to `never` when the second operand is `never`", () => {
			expectTypeOf<Merge<{ a: 1 }, never>>().toBeNever();
		});

		it("should collapse to `never` when the first operand is `never`", () => {
			expectTypeOf<Merge<never, { a: 1 }>>().toBeNever();
		});
	});

	describe("any operands", () => {
		it("should widen existing values and add an index signature when the second operand is `any`", () => {
			expectTypeOf<Merge<{ a: 1 }, any>>().branded.toEqualTypeOf<
				{ a: any } & { [x: string]: any }
			>();
		});

		it("should add an index signature while keeping the second operand's declarations when the first operand is `any`", () => {
			expectTypeOf<Merge<any, { a: 1 }>>().branded.toEqualTypeOf<
				{ [x: string]: any } & { a: 1 }
			>();
		});
	});

	describe("optional modifier", () => {
		it("should union an optional override with the base value instead of replacing it", () => {
			interface A {
				a: string;
			}
			interface B {
				a?: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: string | number | undefined;
			}>();
		});

		it("should keep the merged key required when the base declares it required", () => {
			interface A {
				a: string;
			}
			interface B {
				a?: string;
			}

			expectTypeOf<
				NonNullable<unknown> extends Pick<Merge<A, B>, "a">
					? true
					: false
			>().toEqualTypeOf<false>();
			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: string | undefined;
			}>();
		});

		it("should let the second operand tighten an optional key to required", () => {
			interface A {
				a?: string;
			}
			interface B {
				a: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a: string }>();
		});

		it("should keep an optional second-only key optional", () => {
			interface A {
				a: string;
			}
			interface B {
				b?: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: string;
				b?: number;
			}>();
		});

		it("should keep the `?` modifier when both operands declare the key optional", () => {
			interface A {
				a?: string;
			}
			interface B {
				a?: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a?: string | number;
			}>();
		});
	});

	describe("readonly modifier", () => {
		it("should let the second operand introduce `readonly` on a shared key", () => {
			interface A {
				a: string;
			}
			interface B {
				readonly a: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				readonly a: string;
			}>();
		});

		it("should let the second operand strip `readonly` from a shared key", () => {
			interface A {
				readonly a: string;
			}
			interface B {
				a: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a: string }>();
		});

		it("should preserve the first operand's `readonly` when the override is optional", () => {
			interface A {
				readonly a: string;
			}
			interface B {
				a?: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				readonly a: string | number | undefined;
			}>();
		});
	});

	describe("nested object values", () => {
		it("should replace a nested object entirely instead of deep-merging", () => {
			interface A {
				a: { a: string; b: string };
			}
			interface B {
				a: { a: number };
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a: { a: number };
			}>();
		});
	});

	describe("non-string keys", () => {
		it("should override a numeric-literal key while keeping unrelated ones", () => {
			interface A {
				0: string;
				1: number;
			}
			interface B {
				1: boolean;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				0: string;
				1: boolean;
			}>();
		});
	});

	describe("symbol keys", () => {
		const sym = Symbol("k");
		type Sym = typeof sym;

		it("should keep the first operand's symbol key instead of letting the second override it", () => {
			interface A {
				[sym]: string;
			}
			interface B {
				[sym]: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<
				Record<Sym, string>
			>();
		});

		it("should drop a symbol key contributed only by the second operand", () => {
			interface A {
				a: 1;
			}
			interface B {
				[sym]: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a: 1 }>();
		});

		it("should still merge string keys when symbol keys are present on both sides", () => {
			interface A {
				a: string;
				[sym]: string;
			}
			interface B {
				a: number;
				b: boolean;
				[sym]: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<
				{ a: number; b: boolean } & Record<Sym, string>
			>();
		});
	});

	describe("index signatures", () => {
		it("should union both index signatures since either side's value can survive per key", () => {
			interface A {
				[k: string]: number;
			}
			interface B {
				[k: string]: string;
			}

			expectTypeOf<Merge<A, B>[string]>().toEqualTypeOf<
				number | string
			>();
		});

		it("should union a concrete key from the first operand with the second's index signature", () => {
			interface A {
				id: string;
			}
			interface B {
				[k: string]: number;
			}

			expectTypeOf<Merge<A, B>["id"]>().toEqualTypeOf<string | number>();
		});

		it("should keep the second operand's index signature reachable on the merged type", () => {
			interface A {
				id: string;
			}
			interface B {
				[k: string]: number;
			}

			expectTypeOf<Merge<A, B>["other"]>().toEqualTypeOf<number>();
		});

		it("should replace a key reached only through the first operand's index signature", () => {
			interface A {
				[k: string]: number;
			}
			interface B {
				id: string;
			}

			expectTypeOf<Merge<A, B>["id"]>().toEqualTypeOf<string>();
			expectTypeOf<Merge<A, B>["other"]>().toEqualTypeOf<number>();
		});

		it("should union the declarations when the overlapping key is optional on both sides", () => {
			interface A {
				a?: string;
			}
			interface B {
				a?: number;
			}

			expectTypeOf<Merge<A, B>["a"]>().toEqualTypeOf<
				string | number | undefined
			>();
		});
	});

	describe("index-signature base with an optional concrete override", () => {
		interface A {
			[k: string]: number;
		}
		interface B {
			id?: string;
		}

		type M = Merge<A, B>;

		it("should keep the optional concrete key and union it with the index-signature value", () => {
			expectTypeOf<M["id"]>().toEqualTypeOf<
				string | number | undefined
			>();
		});

		it("should keep `keyof` limited to the index signature's key types", () => {
			expectTypeOf<keyof M>().toEqualTypeOf<string | number>();
		});

		it("should keep the surviving concrete key optional", () => {
			expectTypeOf<
				NonNullable<unknown> extends Pick<M, "id"> ? true : false
			>().toEqualTypeOf<true>();
		});

		it("should still replace wholesale when the concrete key is required", () => {
			interface C {
				id: string;
			}

			expectTypeOf<Merge<A, C>["id"]>().toEqualTypeOf<string>();
		});
	});

	describe("template-literal index signatures", () => {
		it("should replace a key matched only by the first operand's template pattern", () => {
			interface A {
				[k: `x-${string}`]: number;
			}
			interface B {
				"x-a": string;
			}

			expectTypeOf<Merge<A, B>["x-a"]>().toEqualTypeOf<string>();
		});

		it("should keep the first operand's template pattern reachable for non-overridden keys", () => {
			interface A {
				[k: `x-${string}`]: number;
			}
			interface B {
				"x-a": string;
			}

			expectTypeOf<Merge<A, B>["x-b"]>().toEqualTypeOf<number>();
		});

		it("should union a declared key with a template pattern contributed by the second operand", () => {
			interface A {
				"x-a": number;
			}
			interface B {
				[k: `x-${string}`]: string;
			}

			expectTypeOf<Merge<A, B>["x-a"]>().toEqualTypeOf<number | string>();
		});
	});

	describe("idempotence", () => {
		it("should resolve to the same shape when an object is merged with itself", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<Merge<A, A>>().branded.toEqualTypeOf<A>();
		});
	});

	describe("method-syntax properties", () => {
		it("should let the second operand override a method-syntax property", () => {
			interface A {
				a(value: string): number;
			}
			interface B {
				a(value: number): string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				a(value: number): string;
			}>();
		});
	});

	describe("rejected inputs", () => {
		it("should reject a primitive base operand", () => {
			// @ts-expect-error - string does not satisfy `T extends object`
			type _A = Merge<string, { a: 1 }>;
		});

		it("should reject a primitive overrides operand", () => {
			// @ts-expect-error - number does not satisfy `U extends object`
			type _A = Merge<{ a: 1 }, number>;
		});
	});
});
