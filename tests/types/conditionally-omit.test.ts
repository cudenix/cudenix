import { describe, expectTypeOf, test } from "bun:test";

import type { ConditionallyOmit } from "@/types/conditionally-omit";

describe("ConditionallyOmit", () => {
	describe("with marker `never`", () => {
		test("should drop a single `never` key and keep the rest", () => {
			interface Source {
				count: number;
				flag: never;
				name: string;
			}

			expectTypeOf<ConditionallyOmit<Source, never>>().toEqualTypeOf<{
				name: string;
				count: number;
			}>();
		});

		test("should drop every `never` key when multiple are present", () => {
			interface Source {
				a: never;
				b: never;
				c: number;
				d: string;
			}

			expectTypeOf<ConditionallyOmit<Source, never>>().toEqualTypeOf<{
				c: number;
				d: string;
			}>();
		});

		test("should leave the object unchanged when no keys are `never`", () => {
			interface Source {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<Source, never>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("with marker `unknown`", () => {
		test("should drop a single `unknown` key", () => {
			interface Source {
				drop: unknown;
				keep: string;
			}

			expectTypeOf<ConditionallyOmit<Source, unknown>>().toEqualTypeOf<{
				keep: string;
			}>();
		});

		test("should drop every `unknown` key when multiple are present", () => {
			interface Source {
				a: unknown;
				b: unknown;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<Source, unknown>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		test("should leave the object unchanged when no keys are `unknown`", () => {
			interface Source {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<Source, unknown>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("with marker `null`", () => {
		test("should drop a `null`-valued key", () => {
			interface Source {
				drop: null;
				keep: string;
			}

			expectTypeOf<ConditionallyOmit<Source, null>>().toEqualTypeOf<{
				keep: string;
			}>();
		});

		test("should drop every `null`-valued key when multiple are present", () => {
			interface Source {
				a: null;
				b: null;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<Source, null>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		test("should leave the object unchanged when no keys are `null`", () => {
			interface Source {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<Source, null>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("with marker `undefined`", () => {
		test("should drop an `undefined`-valued key", () => {
			interface Source {
				drop: undefined;
				keep: string;
			}

			expectTypeOf<
				ConditionallyOmit<Source, undefined>
			>().toEqualTypeOf<{ keep: string }>();
		});

		test("should drop every `undefined`-valued key when multiple are present", () => {
			interface Source {
				a: undefined;
				b: undefined;
				c: number;
			}

			expectTypeOf<
				ConditionallyOmit<Source, undefined>
			>().toEqualTypeOf<{ c: number }>();
		});

		test("should leave the object unchanged when no keys are `undefined`", () => {
			interface Source {
				a: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOmit<Source, undefined>
			>().toEqualTypeOf<{ a: string; b: number }>();
		});
	});

	describe("`any` collapses mutual assignability", () => {
		test("should drop every key when the marker is `any`", () => {
			interface Source {
				a: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOmit<Source, any>
			>().toEqualTypeOf<NonNullable<unknown>>();
		});

		test("should drop an `any`-valued key even under a narrow marker", () => {
			interface Source {
				drop: any;
				keep: number;
			}

			expectTypeOf<ConditionallyOmit<Source, string>>().toEqualTypeOf<{
				keep: number;
			}>();
		});
	});

	describe("structural mutual-assignability match", () => {
		test("should only drop keys whose value is mutually assignable with the marker", () => {
			interface Source {
				broad: string;
				exact: "foo";
				narrow: "bar";
			}

			expectTypeOf<ConditionallyOmit<Source, "foo">>().toEqualTypeOf<{
				broad: string;
				narrow: "bar";
			}>();
		});

		test("should not drop a key whose value is a wider supertype of the marker", () => {
			interface Source {
				matching: "x";
				wider: string;
			}

			expectTypeOf<ConditionallyOmit<Source, "x">>().toEqualTypeOf<{
				wider: string;
			}>();
		});

		test("should not drop a key whose value is a strict subtype of the marker", () => {
			interface Source {
				exact: string;
				sub: "a";
			}

			expectTypeOf<ConditionallyOmit<Source, string>>().toEqualTypeOf<{
				sub: "a";
			}>();
		});

		test("should drop only the union-valued key whose union matches the marker exactly", () => {
			interface Source {
				full: "a" | "b";
				member: "a";
			}

			expectTypeOf<
				ConditionallyOmit<Source, "a" | "b">
			>().toEqualTypeOf<{ member: "a" }>();
		});

		test("should drop a key whose object value is structurally identical to the object marker", () => {
			interface Source {
				match: { x: number };
				other: string;
			}

			expectTypeOf<
				ConditionallyOmit<Source, { x: number }>
			>().toEqualTypeOf<{ other: string }>();
		});
	});

	describe("preservation of retained keys and modifiers", () => {
		test("should keep all keys when the marker matches none of them", () => {
			interface Source {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<ConditionallyOmit<Source, symbol>>().toEqualTypeOf<{
				a: string;
				b: number;
				c: boolean;
			}>();
		});

		test("should preserve the optional modifier on retained keys", () => {
			interface Source {
				drop: never;
				keep?: string;
			}

			expectTypeOf<ConditionallyOmit<Source, never>>().toEqualTypeOf<{
				keep?: string;
			}>();
		});

		test("should preserve the `readonly` modifier on retained keys", () => {
			interface Source {
				drop: never;
				readonly locked: string;
			}

			expectTypeOf<ConditionallyOmit<Source, never>>().toEqualTypeOf<{
				readonly locked: string;
			}>();
		});
	});

	describe("edge shapes", () => {
		test("should be a no-op on an empty object", () => {
			type Source = NonNullable<unknown>;

			expectTypeOf<
				ConditionallyOmit<Source, never>
			>().toEqualTypeOf<NonNullable<unknown>>();
		});

		test("should produce an empty object when every key matches the marker", () => {
			interface Source {
				a: never;
				b: never;
			}

			expectTypeOf<
				ConditionallyOmit<Source, never>
			>().toEqualTypeOf<NonNullable<unknown>>();
		});

		test("should leave an optional `never` key untouched because indexed access widens it to `undefined`", () => {
			interface Source {
				keep: string;
				maybe?: never;
			}

			expectTypeOf<ConditionallyOmit<Source, never>>().toEqualTypeOf<{
				keep: string;
				maybe?: never;
			}>();
		});
	});
});
