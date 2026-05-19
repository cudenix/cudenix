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

		test("should resolve to true for an index signature with unknown value", () => {
			type Source = Record<string, unknown>;

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
	});
});
