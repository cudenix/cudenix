import { describe, expectTypeOf, test } from "bun:test";

import type { Merge } from "@/types/merge";

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
				keep: number;
			}
			interface B {
				other: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				keep: number;
				other: string;
			}>();
		});

		test("should include keys present only in the second operand", () => {
			interface A {
				id: string;
			}
			interface B {
				total: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				id: string;
				total: number;
			}>();
		});
	});

	describe("with overlapping keys", () => {
		test("should let the second operand override a key declared in the first", () => {
			interface A {
				tags: string[];
			}
			interface B {
				tags: readonly string[];
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				tags: readonly string[];
			}>();
		});

		test("should let the second operand replace the value type entirely", () => {
			interface A {
				id: string;
			}
			interface B {
				id: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ id: number }>();
		});

		test("should let the second operand narrow a wide value type", () => {
			interface A {
				mode: string;
			}
			interface B {
				mode: "auto" | "manual";
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				mode: "auto" | "manual";
			}>();
		});

		test("should let the second operand broaden a narrow value type", () => {
			interface A {
				mode: "auto";
			}
			interface B {
				mode: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				mode: string;
			}>();
		});
	});

	describe("with overlapping and disjoint keys combined", () => {
		test("should mix overridden, first-only and second-only keys correctly", () => {
			interface A {
				first: 1;
				id: string;
				tags: string[];
			}
			interface B {
				tags: readonly string[];
				total: number;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				id: string;
				tags: readonly string[];
				first: 1;
				total: number;
			}>();
		});
	});

	describe("optional modifier", () => {
		test("should respect the second operand's optional modifier on a shared key", () => {
			interface A {
				x: string;
			}
			interface B {
				x?: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ x?: string }>();
		});

		test("should let the second operand tighten an optional key to required", () => {
			interface A {
				x?: string;
			}
			interface B {
				x: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ x: string }>();
		});
	});

	describe("readonly modifier", () => {
		test("should let the second operand introduce `readonly` on a shared key", () => {
			interface A {
				id: string;
			}
			interface B {
				readonly id: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				readonly id: string;
			}>();
		});

		test("should let the second operand strip `readonly` from a shared key", () => {
			interface A {
				readonly id: string;
			}
			interface B {
				id: string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{ id: string }>();
		});
	});

	describe("nested object values", () => {
		test("should replace a nested object entirely instead of deep-merging", () => {
			interface A {
				user: { id: string; name: string };
			}
			interface B {
				user: { age: number };
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				user: { age: number };
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
				process(value: string): number;
			}
			interface B {
				process(value: number): string;
			}

			expectTypeOf<Merge<A, B>>().branded.toEqualTypeOf<{
				process(value: number): string;
			}>();
		});
	});
});
