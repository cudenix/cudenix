import { describe, expectTypeOf, test } from "bun:test";

import type { ConditionallyOmit } from "@/types/conditionally-omit";

describe("ConditionallyOmit", () => {
	describe("with marker `never`", () => {
		test("should drop a single `never` key and keep the rest", () => {
			interface A {
				a: number;
				b: never;
				c: string;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				c: string;
				a: number;
			}>();
		});

		test("should drop every `never` key when multiple are present", () => {
			interface A {
				a: never;
				b: never;
				c: number;
				d: string;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				c: number;
				d: string;
			}>();
		});

		test("should leave the object unchanged when no keys are `never`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("with marker `unknown`", () => {
		test("should drop a single `unknown` key", () => {
			interface A {
				a: unknown;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		test("should drop every `unknown` key when multiple are present", () => {
			interface A {
				a: unknown;
				b: unknown;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		test("should leave the object unchanged when no keys are `unknown`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("with marker `null`", () => {
		test("should drop a `null`-valued key", () => {
			interface A {
				a: null;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, null>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		test("should drop every `null`-valued key when multiple are present", () => {
			interface A {
				a: null;
				b: null;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, null>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		test("should leave the object unchanged when no keys are `null`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, null>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("with marker `undefined`", () => {
		test("should drop an `undefined`-valued key", () => {
			interface A {
				a: undefined;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, undefined>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		test("should drop every `undefined`-valued key when multiple are present", () => {
			interface A {
				a: undefined;
				b: undefined;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, undefined>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		test("should leave the object unchanged when no keys are `undefined`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, undefined>>().toEqualTypeOf<{
				a: string;
				b: number;
			}>();
		});
	});

	describe("`any` collapses mutual assignability", () => {
		test("should drop every key when the marker is `any`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, any>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should drop an `any`-valued key even under a narrow marker", () => {
			interface A {
				a: any;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<{
				b: number;
			}>();
		});
	});

	describe("structural mutual-assignability match", () => {
		test("should only drop keys whose value is mutually assignable with the marker", () => {
			interface A {
				a: string;
				b: "v1";
				c: "v2";
			}

			expectTypeOf<ConditionallyOmit<A, "v1">>().toEqualTypeOf<{
				a: string;
				c: "v2";
			}>();
		});

		test("should not drop a key whose value is a wider supertype of the marker", () => {
			interface A {
				a: "v1";
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, "v1">>().toEqualTypeOf<{
				b: string;
			}>();
		});

		test("should not drop a key whose value is a strict subtype of the marker", () => {
			interface A {
				a: string;
				b: "v1";
			}

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<{
				b: "v1";
			}>();
		});

		test("should drop only the union-valued key whose union matches the marker exactly", () => {
			interface A {
				a: "v1" | "v2";
				b: "v1";
			}

			expectTypeOf<ConditionallyOmit<A, "v1" | "v2">>().toEqualTypeOf<{
				b: "v1";
			}>();
		});

		test("should drop a key whose object value is structurally identical to the object marker", () => {
			interface A {
				a: { a: number };
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, { a: number }>>().toEqualTypeOf<{
				b: string;
			}>();
		});
	});

	describe("preservation of retained keys and modifiers", () => {
		test("should keep all keys when the marker matches none of them", () => {
			interface A {
				a: string;
				b: number;
				c: boolean;
			}

			expectTypeOf<ConditionallyOmit<A, symbol>>().toEqualTypeOf<{
				a: string;
				b: number;
				c: boolean;
			}>();
		});

		test("should preserve the optional modifier on retained keys", () => {
			interface A {
				a: never;
				b?: string;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				b?: string;
			}>();
		});

		test("should preserve the `readonly` modifier on retained keys", () => {
			interface A {
				a: never;
				readonly b: string;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				readonly b: string;
			}>();
		});
	});

	describe("index signatures", () => {
		test("should drop every key from a record whose value matches the marker", () => {
			type A = Record<string, string>;

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should drop every key from a record whose value is unknown when the marker is unknown", () => {
			type A = Record<string, unknown>;

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should leave a record untouched when the marker does not match the value type", () => {
			type A = Record<string, number>;

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<A>();
		});
	});

	describe("edge shapes", () => {
		test("should be a no-op on an empty object", () => {
			type A = NonNullable<unknown>;

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should produce an empty object when every key matches the marker", () => {
			interface A {
				a: never;
				b: never;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		test("should leave an optional `never` key untouched because indexed access widens it to `undefined`", () => {
			interface A {
				a: string;
				b?: never;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				a: string;
				b?: never;
			}>();
		});
	});
});
