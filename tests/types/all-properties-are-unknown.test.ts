import { describe, expect, test } from "bun:test";

import type { AllPropertiesAreUnknown } from "@/types/all-properties-are-unknown";
import type { ExtendsType } from "@/types/extends-type";

describe("AllPropertiesAreUnknown", () => {
	describe("homogeneous unknown shapes", () => {
		test("should resolve to true when every property is unknown", () => {
			interface Source {
				a: unknown;
				b: unknown;
				c: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for a single-key unknown shape", () => {
			interface Source {
				only: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for a string-keyed unknown index signature", () => {
			type Source = Record<string, unknown>;

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for a number-keyed unknown index signature", () => {
			type Source = Record<number, unknown>;

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for a symbol-keyed unknown index signature", () => {
			type Source = Record<symbol, unknown>;

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for a mix of required and optional unknown keys", () => {
			interface Source {
				a: unknown;
				b?: unknown;
				c: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a readonly modifier accompanies an unknown property", () => {
			interface Source {
				readonly a: unknown;
				b: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when a property's union value collapses into unknown", () => {
			interface Source {
				a: unknown | string;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for the canonical two-key unknown shape from the JSDoc example", () => {
			const check: ExtendsType<
				AllPropertiesAreUnknown<{ a: unknown; b: unknown }>,
				true
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("mixed shapes", () => {
		test("should resolve to false when one property is concrete and others are unknown", () => {
			interface Source {
				a: unknown;
				b: string;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when every property is concrete", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for an index signature with a concrete value type", () => {
			type Source = Record<string, string>;

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a property is a narrow union without unknown", () => {
			interface Source {
				a: "x" | "y";
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for the canonical mixed shape from the JSDoc example", () => {
			const check: ExtendsType<
				AllPropertiesAreUnknown<{ a: unknown; b: string }>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("empty and synthetic shapes", () => {
		type Empty = NonNullable<unknown>;

		test("should resolve to true for an empty object (no keys to falsify)", () => {
			const check: ExtendsType<
				AllPropertiesAreUnknown<Empty>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for an inline empty object literal", () => {
			const check: ExtendsType<
				AllPropertiesAreUnknown<NonNullable<unknown>>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for the JSDoc empty-object literal `{}`", () => {
			const check: ExtendsType<
				AllPropertiesAreUnknown<{}>,
				true
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("optional and undefined-containing values", () => {
		test("should treat an optional unknown property as unknown (true)", () => {
			interface Source {
				a?: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a property is `string | undefined` (still not unknown)", () => {
			interface Source {
				a: string | undefined;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("any-typed properties", () => {
		test("should resolve to true when a property is typed `any` (unknown extends any)", () => {
			interface Source {
				a: any;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true when every property is typed `any`", () => {
			interface Source {
				a: any;
				b: any;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to true for a mix of `any` and `unknown` properties", () => {
			interface Source {
				a: any;
				b: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				true
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when an `any` property is paired with a concrete property", () => {
			interface Source {
				a: any;
				b: string;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("bottom and nullish value types", () => {
		test("should resolve to false when a property is typed `never`", () => {
			interface Source {
				a: never;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a single `never` is mixed with unknown keys", () => {
			interface Source {
				a: unknown;
				b: never;
				c: unknown;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a property is typed `null`", () => {
			interface Source {
				a: null;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false when a property is typed `undefined` and is not optional", () => {
			interface Source {
				a: undefined;
			}

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("tuple and array shapes", () => {
		test("should resolve to false for a tuple of unknown elements because of synthetic members", () => {
			type Source = [unknown, unknown];

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to false for an array of unknown elements because of synthetic members", () => {
			type Source = unknown[];

			const check: ExtendsType<
				AllPropertiesAreUnknown<Source>,
				false
			> = true;

			expect(check).toBe(true);
		});
	});
});
