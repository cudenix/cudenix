import { describe, expectTypeOf, test } from "bun:test";

import type { ValueOf } from "@/utils/types/value-of";

describe("ValueOf", () => {
	describe("plain dictionaries", () => {
		test("should resolve to a single type for a single-key dictionary", () => {
			interface A {
				a: number;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<number>();
		});

		test("should resolve to the union of value types for a multi-key dictionary", () => {
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
		test("should resolve to the union of string literal values", () => {
			const a = { a: "v1", b: "v2" } as const;

			type A = ValueOf<typeof a>;

			expectTypeOf<A>().toEqualTypeOf<"v2" | "v1">();
		});

		test("should resolve to the union of numeric literal values", () => {
			const a = { a: 1, b: 2, c: 3 } as const;

			type A = ValueOf<typeof a>;

			expectTypeOf<A>().toEqualTypeOf<1 | 2 | 3>();
		});

		test("should resolve to the union of boolean literal values", () => {
			const a = { a: false, b: true } as const;

			type A = ValueOf<typeof a>;

			expectTypeOf<A>().toEqualTypeOf<true | false>();
		});
	});

	describe("mixed value types", () => {
		test("should preserve literal types within the union", () => {
			interface A {
				a: "v1";
				b: 1;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1" | 1>();
		});

		test("should preserve heterogeneous value-type unions", () => {
			interface A {
				a: number;
				b: string;
				c: string[];
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				string | number | string[]
			>();
		});
	});

	describe("modifiers", () => {
		test("should ignore the `readonly` modifier when collecting value types", () => {
			interface A {
				readonly a: string;
				readonly b: number;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<string | number>();
		});

		test("should include `undefined` for an optional (`?`) key", () => {
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
		test("should preserve values keyed by numeric literals", () => {
			interface A {
				1: "v1";
				2: "v2";
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1" | "v2">();
		});

		test("should preserve values keyed by `symbol`", () => {
			const sym = Symbol("key");

			interface A {
				a: string;
				[sym]: boolean;
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<boolean | string>();
		});
	});

	describe("complex value types", () => {
		test("should preserve nested object value types", () => {
			interface A {
				a: { a: number };
				b: { a: string };
			}

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<
				{ a: number } | { a: string }
			>();
		});

		test("should preserve function value types", () => {
			type A = () => void;
			type B = (input: string) => string;

			interface C {
				a: B;
				b: A;
			}

			expectTypeOf<ValueOf<C>>().toEqualTypeOf<A | B>();
		});

		test("should preserve `null` and `undefined` as explicit value types", () => {
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
		test("should resolve to the value type for `Record<string, V>`", () => {
			type A = Record<string, number>;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<number>();
		});

		test('should resolve to the union value type for `Record<string, "v1" | "v2">`', () => {
			type A = Record<string, "v1" | "v2">;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1" | "v2">();
		});

		test("should resolve to the value type for `Record<number, V>`", () => {
			type A = Record<number, boolean>;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<boolean>();
		});

		test("should resolve to the value type for `Record<symbol, V>`", () => {
			type A = Record<symbol, "v1">;

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<"v1">();
		});

		test("should resolve to `unknown` for `Record<string, unknown>`", () => {
			type A = Record<string, unknown>;

			expectTypeOf<ValueOf<A>>().toBeUnknown();
		});

		test("should resolve to `any` for `Record<string, any>`", () => {
			type A = Record<string, any>;

			expectTypeOf<ValueOf<A>>().toBeAny();
		});

		test("should resolve to `never` for `Record<string, never>`", () => {
			type A = Record<string, never>;

			expectTypeOf<ValueOf<A>>().toBeNever();
		});
	});

	describe("tuple and array sources", () => {
		test("should include the element types of a tuple in the union", () => {
			type A = [string, number];

			expectTypeOf<string>().toExtend<ValueOf<A>>();
			expectTypeOf<number>().toExtend<ValueOf<A>>();
		});

		test("should include the element type of a homogeneous array in the union", () => {
			type A = string[];

			expectTypeOf<string>().toExtend<ValueOf<A>>();
		});
	});

	describe("edge cases", () => {
		test("should resolve to `never` for an empty object", () => {
			type A = NonNullable<unknown>;

			expectTypeOf<ValueOf<A>>().toBeNever();
		});

		test("should union value types across an intersection of objects", () => {
			type A = { a: string } & { b: number };

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<string | number>();
		});

		test("should collapse a union of objects to the values of only their shared keys", () => {
			type A = { a: string; b: number } | { a: boolean; c: string };

			expectTypeOf<ValueOf<A>>().toEqualTypeOf<string | boolean>();
		});

		test("should resolve to `never` for a union of objects with no shared keys", () => {
			type A = { a: string } | { b: number };

			expectTypeOf<ValueOf<A>>().toBeNever();
		});
	});
});
