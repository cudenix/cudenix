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
				b: string;
				c: readonly string[];
				a: 1;
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

	describe("optional modifier", () => {
		it("should respect the second operand's optional modifier on a shared key", () => {
			interface A {
				a: string;
			}
			interface B {
				a?: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a?: string }>();
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

		it("should let the second operand override a `symbol`-keyed property", () => {
			const sym = Symbol("k");
			type Sym = typeof sym;

			interface A {
				[sym]: string;
			}
			interface B {
				[sym]: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<
				Record<Sym, number>
			>();
		});
	});

	describe("index signatures", () => {
		it("should let the second operand's index signature override the first's", () => {
			interface A {
				[k: string]: number;
			}
			interface B {
				[k: string]: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				[k: string]: string;
			}>();
		});

		it("should let an index signature in the second operand absorb concrete keys from the first", () => {
			interface A {
				id: string;
			}
			interface B {
				[k: string]: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				[k: string]: number;
			}>();
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
