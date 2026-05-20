import { describe, expectTypeOf, test } from "bun:test";

import type { AllPropertiesAreUnknown } from "@/types/all-properties-are-unknown";

describe("AllPropertiesAreUnknown", () => {
	describe("homogeneous unknown shapes", () => {
		test("should resolve to true for the canonical two-key unknown shape from the JSDoc example", () => {
			expectTypeOf<
				AllPropertiesAreUnknown<{ a: unknown; b: unknown }>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a single-key unknown shape", () => {
			interface Source {
				only: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when every property is unknown", () => {
			interface Source {
				a: unknown;
				b: unknown;
				c: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a mix of required and optional unknown keys", () => {
			interface Source {
				a: unknown;
				b?: unknown;
				c: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a readonly modifier accompanies an unknown property", () => {
			interface Source {
				readonly a: unknown;
				b: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when a property's union value collapses into unknown", () => {
			interface Source {
				a: unknown | string;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});
	});

	describe("index signatures", () => {
		test("should resolve to true for a string-keyed unknown index signature", () => {
			type Source = Record<string, unknown>;

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a number-keyed unknown index signature", () => {
			type Source = Record<number, unknown>;

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a symbol-keyed unknown index signature", () => {
			type Source = Record<symbol, unknown>;

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false for an index signature with a concrete value type", () => {
			type Source = Record<string, string>;

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});

	describe("any-typed properties", () => {
		test("should resolve to true when a property is typed `any` (unknown extends any)", () => {
			interface Source {
				a: any;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true when every property is typed `any`", () => {
			interface Source {
				a: any;
				b: any;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for a mix of `any` and `unknown` properties", () => {
			interface Source {
				a: any;
				b: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when an `any` property is paired with a concrete property", () => {
			interface Source {
				a: any;
				b: string;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});

	describe("optional and undefined-containing values", () => {
		test("should treat an optional unknown property as unknown (true)", () => {
			interface Source {
				a?: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to false when a property is `string | undefined` (still not unknown)", () => {
			interface Source {
				a: string | undefined;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});

	describe("empty and synthetic shapes", () => {
		type Empty = NonNullable<unknown>;

		test("should resolve to true for the JSDoc empty-object literal `{}`", () => {
			expectTypeOf<AllPropertiesAreUnknown<{}>>().toEqualTypeOf<true>();
		});

		test("should resolve to true for an empty object via `NonNullable<unknown>` alias", () => {
			expectTypeOf<
				AllPropertiesAreUnknown<Empty>
			>().toEqualTypeOf<true>();
		});

		test("should resolve to true for an instance of a class with no own properties", () => {
			class Bare {}

			expectTypeOf<
				AllPropertiesAreUnknown<Bare>
			>().toEqualTypeOf<true>();
		});
	});

	describe("mixed unknown and concrete properties", () => {
		test("should resolve to false for the canonical mixed shape from the JSDoc example", () => {
			expectTypeOf<
				AllPropertiesAreUnknown<{ a: unknown; b: string }>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when one property is concrete and others are unknown", () => {
			interface Source {
				a: unknown;
				b: string;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});

	describe("entirely concrete property types", () => {
		test("should resolve to false when every property is concrete", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a property is a narrow union without unknown", () => {
			interface Source {
				a: "x" | "y";
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});

	describe("bottom and nullish value types", () => {
		test("should resolve to false when a property is typed `null`", () => {
			interface Source {
				a: null;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a property is typed `undefined` and is not optional", () => {
			interface Source {
				a: undefined;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a property is typed `never`", () => {
			interface Source {
				a: never;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false when a single `never` is mixed with unknown keys", () => {
			interface Source {
				a: unknown;
				b: never;
				c: unknown;
			}

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});

	describe("tuple and array shapes", () => {
		test("should resolve to false for a tuple of unknown elements because of synthetic members", () => {
			type Source = [unknown, unknown];

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});

		test("should resolve to false for an array of unknown elements because of synthetic members", () => {
			type Source = unknown[];

			expectTypeOf<
				AllPropertiesAreUnknown<Source>
			>().toEqualTypeOf<false>();
		});
	});
});
