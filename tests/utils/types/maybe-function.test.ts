import { describe, expectTypeOf, it } from "bun:test";

import type { MaybeFunction } from "@/utils/types/maybe-function";

describe("MaybeFunction", () => {
	describe("direct-value branch", () => {
		it("should accept a concrete number value", () => {
			expectTypeOf<number>().toExtend<MaybeFunction<number>>();
		});

		it("should accept a concrete string value", () => {
			expectTypeOf<string>().toExtend<MaybeFunction<string>>();
		});

		it("should accept a structured value when wrapping an object type", () => {
			interface A {
				a: string;
			}

			expectTypeOf<A>().toExtend<MaybeFunction<A>>();
		});
	});

	describe("sync-factory branch", () => {
		it("should accept a zero-arg sync factory returning the wrapped type", () => {
			expectTypeOf<() => number>().toExtend<MaybeFunction<number>>();
		});

		it("should accept an arrow factory returning a literal", () => {
			expectTypeOf<() => "a">().toExtend<MaybeFunction<"a">>();
		});
	});

	describe("async-factory branch", () => {
		it("should accept a zero-arg async factory resolving to the wrapped type", () => {
			expectTypeOf<() => Promise<number>>().toExtend<
				MaybeFunction<number>
			>();
		});

		it("should accept a factory that returns a promise explicitly", () => {
			expectTypeOf<() => Promise<string>>().toExtend<
				MaybeFunction<string>
			>();
		});
	});

	describe("mixed-return factory branch", () => {
		it("should expose `T | Promise<T>` as the factory's return type", () => {
			type A = ReturnType<
				Extract<MaybeFunction<number>, (...args: never[]) => unknown>
			>;

			expectTypeOf<A>().toEqualTypeOf<number | Promise<number>>();
		});

		it("should accept a factory returning `T | Promise<T>`", () => {
			expectTypeOf<() => number | Promise<number>>().toExtend<
				MaybeFunction<number>
			>();
		});
	});

	describe("generic-parameter edge cases", () => {
		it("should accept `true` when wrapping `boolean`", () => {
			expectTypeOf<true>().toExtend<MaybeFunction<boolean>>();
		});

		it("should accept `false` when wrapping `boolean`", () => {
			expectTypeOf<false>().toExtend<MaybeFunction<boolean>>();
		});

		it("should accept a `void`-returning factory for fire-and-forget hooks", () => {
			expectTypeOf<() => void>().toExtend<MaybeFunction<void>>();
		});

		it("should accept an explicit `undefined`-yielding factory", () => {
			expectTypeOf<() => undefined>().toExtend<
				MaybeFunction<undefined>
			>();
		});

		it("should accept a union value when the wrapped type is a union", () => {
			expectTypeOf<string>().toExtend<MaybeFunction<number | string>>();
		});

		it("should accept a factory returning a single member of the wrapped union", () => {
			expectTypeOf<() => number>().toExtend<
				MaybeFunction<number | string>
			>();
		});

		it("should accept a factory returning the full wrapped union", () => {
			expectTypeOf<() => number | string>().toExtend<
				MaybeFunction<number | string>
			>();
		});

		it("should accept an async factory resolving to a member of the wrapped union via promise covariance", () => {
			expectTypeOf<() => Promise<number>>().toExtend<
				MaybeFunction<number | string>
			>();
		});
	});

	describe("structural relations", () => {
		it("should resolve to `T | (() => T | Promise<T>)` exactly", () => {
			expectTypeOf<MaybeFunction<number>>().toEqualTypeOf<
				number | (() => number | Promise<number>)
			>();
		});

		it("should treat a bare value as assignable to MaybeFunction<T>", () => {
			expectTypeOf<number>().toExtend<MaybeFunction<number>>();
		});

		it("should treat a sync factory as assignable to MaybeFunction<T>", () => {
			expectTypeOf<() => number>().toExtend<MaybeFunction<number>>();
		});

		it("should treat an async factory as assignable to MaybeFunction<T>", () => {
			expectTypeOf<() => Promise<number>>().toExtend<
				MaybeFunction<number>
			>();
		});

		it("should treat a mixed sync-or-async factory as assignable to MaybeFunction<T>", () => {
			expectTypeOf<() => number | Promise<number>>().toExtend<
				MaybeFunction<number>
			>();
		});

		it("should not collapse the union to its value type", () => {
			expectTypeOf<MaybeFunction<number>>().not.toEqualTypeOf<number>();
		});
	});

	describe("rejection cases", () => {
		it("should reject a bare value of an unrelated type", () => {
			expectTypeOf<string>().not.toExtend<MaybeFunction<number>>();
		});

		it("should reject a factory returning the wrong value type", () => {
			expectTypeOf<() => string>().not.toExtend<MaybeFunction<number>>();
		});

		it("should reject a factory whose promise resolves to the wrong type", () => {
			expectTypeOf<() => Promise<string>>().not.toExtend<
				MaybeFunction<number>
			>();
		});

		it("should reject an async factory resolving outside the wrapped union", () => {
			expectTypeOf<() => Promise<boolean>>().not.toExtend<
				MaybeFunction<number | string>
			>();
		});

		it("should reject a factory that requires arguments", () => {
			expectTypeOf<(arg: string) => number>().not.toExtend<
				MaybeFunction<number>
			>();
		});

		it("should reject a non-function, non-value shape entirely", () => {
			expectTypeOf<{ a: number }>().not.toExtend<MaybeFunction<number>>();
		});
	});

	describe("parameter-arity boundary", () => {
		it("should accept a factory with an optional parameter since it is callable with no arguments", () => {
			expectTypeOf<(arg?: string) => number>().toExtend<
				MaybeFunction<number>
			>();
		});

		it("should accept a factory with only rest parameters since it is callable with no arguments", () => {
			expectTypeOf<(...args: string[]) => number>().toExtend<
				MaybeFunction<number>
			>();
		});
	});
});
