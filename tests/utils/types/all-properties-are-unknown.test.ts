import { describe, expectTypeOf, test } from "bun:test";

import type { AllPropertiesAreUnknown } from "@/utils/types/all-properties-are-unknown";

describe("AllPropertiesAreUnknown", () => {
	describe("homogeneous unknown shapes", () => {
		test("should resolve to true for a canonical two-key unknown shape", () => {
			interface A {
				a: unknown;
				b: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a single-key unknown shape", () => {
			interface A {
				a: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when every property is unknown", () => {
			interface A {
				a: unknown;
				b: unknown;
				c: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a mix of required and optional unknown keys", () => {
			interface A {
				a: unknown;
				b?: unknown;
				c: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a readonly modifier accompanies an unknown property", () => {
			interface A {
				readonly a: unknown;
				b: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a property's union value collapses into unknown", () => {
			interface A {
				a: unknown | string;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});
	});

	describe("index signatures", () => {
		test("should resolve to true for a string-keyed unknown index signature", () => {
			type A = Record<string, unknown>;

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a number-keyed unknown index signature", () => {
			type A = Record<number, unknown>;

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a symbol-keyed unknown index signature", () => {
			type A = Record<symbol, unknown>;

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to false for an index signature with a concrete value type", () => {
			type A = Record<string, string>;

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});

	describe("any-typed properties", () => {
		test("should resolve to true when a property is typed `any` (unknown extends any)", () => {
			interface A {
				a: any;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true when every property is typed `any`", () => {
			interface A {
				a: any;
				b: any;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a mix of `any` and `unknown` properties", () => {
			interface A {
				a: any;
				b: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to false when an `any` property is paired with a concrete property", () => {
			interface A {
				a: any;
				b: string;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});

	describe("optional and undefined-containing values", () => {
		test("should treat an optional unknown property as unknown (true)", () => {
			interface A {
				a?: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});

		test("should resolve to false when a property is `string | undefined` (still not unknown)", () => {
			interface A {
				a: string | undefined;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when an optional property carries a concrete value type", () => {
			interface A {
				a?: string;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});

	describe("empty and synthetic shapes", () => {
		type Empty = NonNullable<unknown>;

		test("should resolve to true for an empty object via `NonNullable<unknown>` alias", () => {
			expectTypeOf<
				AllPropertiesAreUnknown<Empty>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for an instance of a class with no own properties", () => {
			class A {}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<true>();
		});
	});

	describe("mixed unknown and concrete properties", () => {
		test("should resolve to false when one property is concrete and others are unknown", () => {
			interface A {
				a: unknown;
				b: string;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});

	describe("entirely concrete property types", () => {
		test("should resolve to false when every property is concrete", () => {
			interface A {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a property is a narrow union without unknown", () => {
			interface A {
				a: "v1" | "v2";
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});

	describe("bottom and nullish value types", () => {
		test("should resolve to false when a property is typed `null`", () => {
			interface A {
				a: null;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a property is typed `undefined` and is not optional", () => {
			interface A {
				a: undefined;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a property is typed `never`", () => {
			interface A {
				a: never;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a single `never` is mixed with unknown keys", () => {
			interface A {
				a: unknown;
				b: never;
				c: unknown;
			}

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});

	describe("tuple and array shapes", () => {
		test("should resolve to false for a tuple of unknown elements because of synthetic members", () => {
			type A = [unknown, unknown];

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});

		test("should resolve to false for an array of unknown elements because of synthetic members", () => {
			type A = unknown[];

			expectTypeOf<AllPropertiesAreUnknown<A>>().toEqualTypeOf<false>();
		});
	});
});
