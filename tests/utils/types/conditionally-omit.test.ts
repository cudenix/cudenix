import { describe, expectTypeOf, it } from "bun:test";

import type { ConditionallyOmit } from "@/utils/types/conditionally-omit";

describe("ConditionallyOmit", () => {
	describe("with marker `never`", () => {
		it("should drop a single `never` key and keep the rest", () => {
			interface A {
				a: string;
				b: never;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				a: string;
				c: number;
			}>();
		});

		it("should drop every `never` key when multiple are present", () => {
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

		it("should leave the object unchanged when no keys are `never`", () => {
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
		it("should drop a single `unknown` key", () => {
			interface A {
				a: unknown;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		it("should drop every `unknown` key when multiple are present", () => {
			interface A {
				a: unknown;
				b: unknown;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		it("should leave the object unchanged when no keys are `unknown`", () => {
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
		it("should drop a `null`-valued key", () => {
			interface A {
				a: null;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, null>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		it("should drop every `null`-valued key when multiple are present", () => {
			interface A {
				a: null;
				b: null;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, null>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		it("should leave the object unchanged when no keys are `null`", () => {
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
		it("should drop an `undefined`-valued key", () => {
			interface A {
				a: undefined;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, undefined>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		it("should drop every `undefined`-valued key when multiple are present", () => {
			interface A {
				a: undefined;
				b: undefined;
				c: number;
			}

			expectTypeOf<ConditionallyOmit<A, undefined>>().toEqualTypeOf<{
				c: number;
			}>();
		});

		it("should leave the object unchanged when no keys are `undefined`", () => {
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

	describe("`any` markers and values", () => {
		it("should drop every key when the marker is `any`", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, any>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should keep a `never`-valued key under an `any` marker since `any` is not assignable to `never`", () => {
			interface A {
				a: never;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, any>>().toEqualTypeOf<{
				a: never;
			}>();
		});

		it("should drop an `any`-valued key even under a narrow marker", () => {
			interface A {
				a: any;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<{
				b: number;
			}>();
		});

		it("should drop an `any`-valued key under an `unknown` marker", () => {
			interface A {
				a: any;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<{
				b: number;
			}>();
		});

		it("should keep an `any`-valued key under a `never` marker since `any` is not assignable to `never`", () => {
			interface A {
				a: any;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				a: any;
				b: number;
			}>();
		});
	});

	describe("structural mutual-assignability match", () => {
		it("should only drop keys whose value is mutually assignable with the marker", () => {
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

		it("should not drop a key whose value is a wider supertype of the marker", () => {
			interface A {
				a: "v1";
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, "v1">>().toEqualTypeOf<{
				b: string;
			}>();
		});

		it("should not drop a key whose value is a strict subtype of the marker", () => {
			interface A {
				a: string;
				b: "v1";
			}

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<{
				b: "v1";
			}>();
		});

		it("should drop only the union-valued key whose union matches the marker exactly", () => {
			interface A {
				a: "v1" | "v2";
				b: "v1";
			}

			expectTypeOf<ConditionallyOmit<A, "v1" | "v2">>().toEqualTypeOf<{
				b: "v1";
			}>();
		});

		it("should drop a key whose object value is structurally identical to the object marker", () => {
			interface A {
				a: { a: number };
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, { a: number }>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		it("should not drop an `unknown`-valued key under a narrow marker", () => {
			interface A {
				a: unknown;
				b: number;
			}

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<{
				a: unknown;
				b: number;
			}>();
		});
	});

	describe("preservation of retained keys and modifiers", () => {
		it("should keep all keys when the marker matches none of them", () => {
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

		it("should preserve the optional modifier on retained keys", () => {
			interface A {
				a: never;
				b?: string;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				b?: string;
			}>();
		});

		it("should preserve the `readonly` modifier on retained keys", () => {
			interface A {
				a: never;
				readonly b: string;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				readonly b: string;
			}>();
		});
	});

	describe("special key kinds", () => {
		it("should drop a `symbol`-keyed property whose value matches the marker", () => {
			const sym = Symbol("k");

			interface A {
				a: number;
				[sym]: string;
			}

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<{
				a: number;
			}>();
		});
	});

	describe("index signatures", () => {
		it("should drop every key from a record whose value matches the marker", () => {
			type A = Record<string, string>;

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should drop every key from a record whose value is unknown when the marker is unknown", () => {
			type A = Record<string, unknown>;

			expectTypeOf<ConditionallyOmit<A, unknown>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should leave a record untouched when the marker does not match the value type", () => {
			type A = Record<string, number>;

			expectTypeOf<ConditionallyOmit<A, string>>().toEqualTypeOf<A>();
		});
	});

	describe("edge shapes", () => {
		it("should be a no-op on an empty object", () => {
			type A = NonNullable<unknown>;

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should produce an empty object when every key matches the marker", () => {
			interface A {
				a: never;
				b: never;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<
				NonNullable<unknown>
			>();
		});

		it("should leave an optional `never` key untouched because indexed access widens it to `undefined`", () => {
			interface A {
				a: string;
				b?: never;
			}

			expectTypeOf<ConditionallyOmit<A, never>>().toEqualTypeOf<{
				a: string;
				b?: never;
			}>();
		});

		it("should drop an optional key whose widened value type matches the marker", () => {
			interface A {
				a?: undefined;
				b: string;
			}

			expectTypeOf<ConditionallyOmit<A, undefined>>().toEqualTypeOf<{
				b: string;
			}>();
		});

		it("should drop an optional key when the marker matches its widened `| undefined` value type", () => {
			interface A {
				a?: string;
				b: number;
			}

			expectTypeOf<
				ConditionallyOmit<A, string | undefined>
			>().toEqualTypeOf<{ b: number }>();
		});
	});
});
