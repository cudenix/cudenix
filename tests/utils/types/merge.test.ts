import { describe, expectTypeOf, test } from "bun:test";

import type { Merge } from "@/utils/types/merge";

describe("Merge", () => {
	describe("with empty operands", () => {
		type Empty = NonNullable<unknown>;

		test("should resolve to an empty object when both operands are empty", () => {
			expectTypeOf<Merge<Empty, Empty>>().branded.toEqualTypeOf<Empty>();
		});

		test("should be a no-op when the second operand is empty", () => {
			interface A {
				a: 1;
				b: 2;
			}

			expectTypeOf<Merge<A, Empty>>().branded.toEqualTypeOf<{
				a: 1;
				b: 2;
			}>();
		});

		test("should resolve to the second operand when the first is empty", () => {
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
		test("should preserve keys present only in the first operand", () => {
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

		test("should include keys present only in the second operand", () => {
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
	});

	describe("with overlapping keys", () => {
		test("should let the second operand override a key declared in the first", () => {
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

		test("should let the second operand replace the value type entirely", () => {
			interface A {
				a: string;
			}
			interface B {
				a: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a: number }>();
		});

		test("should let the second operand narrow a wide value type", () => {
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

		test("should let the second operand broaden a narrow value type", () => {
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
		test("should mix overridden, first-only and second-only keys correctly", () => {
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
	});

	describe("optional modifier", () => {
		test("should respect the second operand's optional modifier on a shared key", () => {
			interface A {
				a: string;
			}
			interface B {
				a?: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ a?: string }>();
		});

		test("should let the second operand tighten an optional key to required", () => {
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
		test("should let the second operand introduce `readonly` on a shared key", () => {
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

		test("should let the second operand strip `readonly` from a shared key", () => {
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
		test("should replace a nested object entirely instead of deep-merging", () => {
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
		test("should override a numeric-literal key while keeping unrelated ones", () => {
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

		test("should let the second operand override a `symbol`-keyed property", () => {
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
		test("should let the second operand's index signature override the first's", () => {
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

		test("should let an index signature in the second operand absorb concrete keys from the first", () => {
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
		test("should resolve to the same shape when an object is merged with itself", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<Merge<A, A>>().branded.toEqualTypeOf<A>();
		});
	});

	describe("method-syntax properties", () => {
		test("should let the second operand override a method-syntax property", () => {
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
});
