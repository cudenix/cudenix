import { describe, expectTypeOf, it } from "bun:test";

import type { ValueOf } from "@/utils/types/value-of";

describe("ValueOf", () => {
	describe("plain dictionaries", () => {
		it("should resolve to a single type for a single-key dictionary", () => {
			interface A {
				a: number;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<number>();
		});

		it("should resolve to the union of value types for a multi-key dictionary", () => {
			interface A {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				string | number | boolean
			>();
		});
	});

	describe("`as const` enum objects", () => {
		it("should resolve to the union of string literal values", () => {
			const a = { a: "v1", b: "v2" } as const;

			type A = ValueOf<typeof a>;

			expectTypeOf<A>().toEqualTypeOf<"v2" | "v1">();
		});

		it("should resolve to the union of numeric literal values", () => {
			const a = { a: 1, b: 2, c: 3 } as const;

			type A = ValueOf<typeof a>;

			expectTypeOf<A>().toEqualTypeOf<1 | 2 | 3>();
		});

		it("should resolve to the union of boolean literal values", () => {
			const a = { a: false, b: true } as const;

			type A = ValueOf<typeof a>;

			expectTypeOf<A>().toEqualTypeOf<true | false>();
		});
	});

	describe("mixed value types", () => {
		it("should preserve literal types within the union", () => {
			interface A {
				a: "v1";
				b: 1;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1" | 1>();
		});

		it("should preserve heterogeneous value-type unions", () => {
			interface A {
				a: number;
				b: string;
				c: string[];
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				string | number | string[]
			>();
		});

		it("should deduplicate keys sharing the same value type", () => {
			interface A {
				a: "v1";
				b: "v1";
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1">();
		});
	});

	describe("modifiers", () => {
		it("should ignore the `readonly` modifier when collecting value types", () => {
			interface A {
				readonly a: string;
				readonly b: number;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<string | number>();
		});

		it("should include `undefined` for an optional (`?`) key", () => {
			interface A {
				a: string;
				b?: number;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				string | number | undefined
			>();
		});
	});

	describe("special key kinds", () => {
		it("should preserve values keyed by numeric literals", () => {
			interface A {
				1: "v1";
				2: "v2";
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1" | "v2">();
		});

		it("should preserve values keyed by `symbol`", () => {
			const sym = Symbol("key");

			interface A {
				a: string;
				[sym]: boolean;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<boolean | string>();
		});
	});

	describe("complex value types", () => {
		it("should preserve nested object value types", () => {
			interface A {
				a: { a: number };
				b: { a: string };
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				{ a: number } | { a: string }
			>();
		});

		it("should preserve function value types", () => {
			type A = () => void;
			type B = (input: string) => string;

			interface C {
				a: B;
				b: A;
			}

			expectTypeOf<ValueOf<C>>().toEqualTypeOf<A | B>();
		});

		it("should preserve `null` and `undefined` as explicit value types", () => {
			interface A {
				a: null;
				b: undefined;
				c: string;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				null | undefined | string
			>();
		});
	});

	describe("index signatures", () => {
		it("should resolve to the value type for `Record<string, V>`", () => {
			type A = Record<string, number>;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<number>();
		});

		it('should resolve to the union value type for `Record<string, "v1" | "v2">`', () => {
			type A = Record<string, "v1" | "v2">;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1" | "v2">();
		});

		it("should resolve to the value type for `Record<number, V>`", () => {
			type A = Record<number, boolean>;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<boolean>();
		});

		it("should resolve to the value type for `Record<symbol, V>`", () => {
			type A = Record<symbol, "v1">;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1">();
		});

		it("should resolve to `unknown` for `Record<string, unknown>`", () => {
			type A = Record<string, unknown>;

			expectTypeOf<ValueOf<A>>().toBeUnknown();
		});

		it("should resolve to `any` for `Record<string, any>`", () => {
			type A = Record<string, any>;

			expectTypeOf<ValueOf<A>>().toBeAny();
		});

		it("should resolve to `never` for `Record<string, never>`", () => {
			type A = Record<string, never>;

			expectTypeOf<ValueOf<A>>().toBeNever();
		});
	});

	describe("tuple and array sources", () => {
		it("should include the element types of a tuple in the union", () => {
			type A = [string, number];

			expectTypeOf<string>().toExtend<ValueOf<A>>();
			expectTypeOf<number>().toExtend<ValueOf<A>>();
		});

		it("should include the element type of a homogeneous array in the union", () => {
			type A = string[];

			expectTypeOf<string>().toExtend<ValueOf<A>>();
		});

		it("should not equal the bare element union for a tuple because the length literal and array-method types leak in", () => {
			type A = [string, "x"];

			expectTypeOf<ValueOf<A>>().not.toEqualTypeOf<string | "x">();
		});
	});

	describe("edge cases", () => {
		it("should resolve to `never` for an empty object", () => {
			type A = NonNullable<unknown>;

			expectTypeOf<ValueOf<A>>().toBeNever();
		});

		it("should union value types across an intersection of objects", () => {
			type A = { a: string } & { b: number };

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<string | number>();
		});

		it("should collapse a union of objects to the values of only their shared keys", () => {
			type A = { a: string; b: number } | { a: boolean; c: string };

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<string | boolean>();
		});

		it("should resolve to `never` for a union of objects with no shared keys", () => {
			type A = { a: string } | { b: number };

			expectTypeOf<ValueOf<A>>().toBeNever();
		});

		it("should resolve to `any` for an `any` source", () => {
			expectTypeOf<ValueOf<any>>().toBeAny();
		});

		it("should resolve to `never` for a `never` source", () => {
			expectTypeOf<ValueOf<never>>().toBeNever();
		});
	});
});
