import { describe, expectTypeOf, it } from "bun:test";

import type { MaybePromise } from "@/utils/types/maybe-promise";

describe("MaybePromise", () => {
	describe("direct-value branch", () => {
		it("should accept a concrete value of the wrapped type", () => {
			expectTypeOf<number>().toExtend<MaybePromise<number>>();
		});

		it("should accept a structured value when wrapping an object type", () => {
			interface A {
				a: string;
			}

			expectTypeOf<A>().toExtend<MaybePromise<A>>();
		});
	});

	describe("promise branch", () => {
		it("should accept a resolved promise of the wrapped type", () => {
			expectTypeOf<Promise<number>>().toExtend<MaybePromise<number>>();
		});

		it("should accept `Promise<string>` when wrapping `string`", () => {
			expectTypeOf<Promise<string>>().toExtend<MaybePromise<string>>();
		});
	});

	describe("function return position", () => {
		it("should accept a synchronous handler returning the wrapped type", () => {
			expectTypeOf<() => Response>().toExtend<
				() => MaybePromise<Response>
			>();
		});

		it("should accept an asynchronous handler resolving to the wrapped type", () => {
			expectTypeOf<() => Promise<Response>>().toExtend<
				() => MaybePromise<Response>
			>();
		});

		it("should reject a handler resolving to an unrelated type", () => {
			expectTypeOf<() => Promise<string>>().not.toExtend<
				() => MaybePromise<Response>
			>();
		});
	});

	describe("structural relations", () => {
		it("should resolve to `T | Promise<T>` (a union, not a nested promise)", () => {
			expectTypeOf<MaybePromise<number>>().toEqualTypeOf<
				number | Promise<number>
			>();
		});

		it("should not collapse the union to its value type", () => {
			expectTypeOf<MaybePromise<number>>().not.toEqualTypeOf<number>();
		});

		it("should not collapse a wrapped promise type", () => {
			expectTypeOf<MaybePromise<Promise<number>>>().toEqualTypeOf<
				Promise<number> | Promise<Promise<number>>
			>();
			expectTypeOf<MaybePromise<Promise<number>>>().not.toEqualTypeOf<
				Promise<number>
			>();
		});
	});

	describe("interaction with `await`", () => {
		it("should collapse to the wrapped type under `Awaited<...>`", () => {
			expectTypeOf<
				Awaited<MaybePromise<number>>
			>().toEqualTypeOf<number>();
		});

		it("should collapse a doubly-wrapped MaybePromise to the wrapped type under `Awaited<...>`", () => {
			expectTypeOf<
				Awaited<MaybePromise<MaybePromise<number>>>
			>().toEqualTypeOf<number>();
		});
	});

	describe("wrapping a union of value types", () => {
		it("should accept the string member of the wrapped union (sync)", () => {
			expectTypeOf<string>().toExtend<MaybePromise<string | number>>();
		});

		it("should accept the number member of the wrapped union (sync)", () => {
			expectTypeOf<number>().toExtend<MaybePromise<string | number>>();
		});

		it("should accept a `Promise<Member>` via promise covariance", () => {
			expectTypeOf<Promise<number>>().toExtend<
				MaybePromise<string | number>
			>();
		});

		it("should resolve to `(A | B) | Promise<A | B>`", () => {
			expectTypeOf<MaybePromise<string | number>>().toEqualTypeOf<
				(string | number) | Promise<string | number>
			>();
		});

		it("should wrap the union as a whole, not distribute over its members", () => {
			expectTypeOf<MaybePromise<string | number>>().not.toEqualTypeOf<
				MaybePromise<string> | MaybePromise<number>
			>();
		});
	});

	describe("nullable wrapped types", () => {
		it("should accept a `null` value when wrapping a nullable type", () => {
			expectTypeOf<null>().toExtend<MaybePromise<string | null>>();
		});

		it("should accept an `undefined` value when wrapping `T | undefined`", () => {
			expectTypeOf<undefined>().toExtend<
				MaybePromise<string | undefined>
			>();
		});

		it("should not add `null` or `undefined` implicitly", () => {
			expectTypeOf<null>().not.toExtend<MaybePromise<string>>();
			expectTypeOf<undefined>().not.toExtend<MaybePromise<string>>();
		});
	});

	describe("`void` specialization", () => {
		it("should accept `undefined` as the synchronous arm", () => {
			expectTypeOf<undefined>().toExtend<MaybePromise<void>>();
		});

		it("should accept `Promise<void>` as the asynchronous arm", () => {
			expectTypeOf<Promise<void>>().toExtend<MaybePromise<void>>();
		});

		it("should resolve to `void | Promise<void>`", () => {
			expectTypeOf<
				MaybePromise<void>
			>().toEqualTypeOf<void | Promise<void>>();
		});
	});

	describe("degenerate wrapped types", () => {
		it("should collapse `never | Promise<never>` to `Promise<never>` when wrapping `never`", () => {
			expectTypeOf<MaybePromise<never>>().toEqualTypeOf<Promise<never>>();
		});

		it("should be absorbed into `any` when wrapping `any`", () => {
			expectTypeOf<MaybePromise<any>>().toBeAny();
		});

		it("should absorb `Promise<unknown>` into `unknown` when wrapping `unknown`", () => {
			expectTypeOf<MaybePromise<unknown>>().toEqualTypeOf<unknown>();
		});
	});

	describe("rejected assignments", () => {
		it("should reject a bare value of an unrelated type", () => {
			expectTypeOf<string>().not.toExtend<MaybePromise<number>>();
		});

		it("should reject a `Promise<U>` where `U` does not extend the wrapped type", () => {
			expectTypeOf<Promise<string>>().not.toExtend<
				MaybePromise<number>
			>();
		});

		it("should reject a `PromiseLike<T>` in place of a real `Promise<T>`", () => {
			expectTypeOf<PromiseLike<number>>().not.toExtend<
				MaybePromise<number>
			>();
		});
	});
});
