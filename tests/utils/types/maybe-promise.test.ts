import { describe, expectTypeOf, test } from "bun:test";

import type { MaybePromise } from "@/utils/types/maybe-promise";

describe("MaybePromise", () => {
	describe("direct-value branch", () => {
		test("should accept a concrete value of the wrapped type", () => {
			expectTypeOf<number>().toExtend<MaybePromise<number>>();
		});

		test("should accept a structured value when wrapping an object type", () => {
			interface A {
				a: string;
			}

			expectTypeOf<A>().toExtend<MaybePromise<A>>();
		});
	});

	describe("promise branch", () => {
		test("should accept a resolved promise of the wrapped type", () => {
			expectTypeOf<Promise<number>>().toExtend<MaybePromise<number>>();
		});

		test("should accept `Promise<string>` when wrapping `string`", () => {
			expectTypeOf<Promise<string>>().toExtend<MaybePromise<string>>();
		});
	});

	describe("structural relations", () => {
		test("should resolve to `T | Promise<T>` (a union, not a nested promise)", () => {
			expectTypeOf<MaybePromise<number>>().toEqualTypeOf<
				number | Promise<number>
			>();
		});

		test("should treat a bare value as assignable", () => {
			expectTypeOf<number>().toExtend<MaybePromise<number>>();
		});

		test("should treat a promise as assignable", () => {
			expectTypeOf<Promise<number>>().toExtend<MaybePromise<number>>();
		});

		test("should not collapse the union to its value type", () => {
			expectTypeOf<MaybePromise<number>>().not.toEqualTypeOf<number>();
		});
	});

	describe("interaction with `await`", () => {
		test("should collapse to the wrapped type under `Awaited<...>`", () => {
			expectTypeOf<
				Awaited<MaybePromise<number>>
			>().toEqualTypeOf<number>();
		});

		test("should collapse a doubly-wrapped MaybePromise to the wrapped type under `Awaited<...>`", () => {
			expectTypeOf<
				Awaited<MaybePromise<MaybePromise<number>>>
			>().toEqualTypeOf<number>();
		});
	});

	describe("wrapping a union of value types", () => {
		test("should accept the string member of the wrapped union (sync)", () => {
			expectTypeOf<string>().toExtend<MaybePromise<string | number>>();
		});

		test("should accept the number member of the wrapped union (sync)", () => {
			expectTypeOf<number>().toExtend<MaybePromise<string | number>>();
		});

		test("should accept a `Promise<Member>` via promise covariance", () => {
			expectTypeOf<Promise<number>>().toExtend<
				MaybePromise<string | number>
			>();
		});

		test("should resolve to `(A | B) | Promise<A | B>`", () => {
			expectTypeOf<MaybePromise<string | number>>().toEqualTypeOf<
				(string | number) | Promise<string | number>
			>();
		});
	});

	describe("nullable wrapped types", () => {
		test("should accept a `null` value when wrapping a nullable type", () => {
			expectTypeOf<null>().toExtend<MaybePromise<string | null>>();
		});

		test("should accept an `undefined` value when wrapping `T | undefined`", () => {
			expectTypeOf<undefined>().toExtend<
				MaybePromise<string | undefined>
			>();
		});
	});

	describe("`void` specialization", () => {
		test("should accept `undefined` as the synchronous arm", () => {
			expectTypeOf<undefined>().toExtend<MaybePromise<void>>();
		});

		test("should accept `Promise<void>` as the asynchronous arm", () => {
			expectTypeOf<Promise<void>>().toExtend<MaybePromise<void>>();
		});

		test("should resolve to `void | Promise<void>`", () => {
			expectTypeOf<
				MaybePromise<void>
			>().toEqualTypeOf<void | Promise<void>>();
		});
	});

	describe("rejected assignments", () => {
		test("should reject a bare value of an unrelated type", () => {
			expectTypeOf<string>().not.toExtend<MaybePromise<number>>();
		});

		test("should reject a `Promise<U>` where `U` does not extend the wrapped type", () => {
			expectTypeOf<Promise<string>>().not.toExtend<
				MaybePromise<number>
			>();
		});

		test("should reject a `PromiseLike<T>` in place of a real `Promise<T>`", () => {
			expectTypeOf<PromiseLike<number>>().not.toExtend<
				MaybePromise<number>
			>();
		});
	});
});
