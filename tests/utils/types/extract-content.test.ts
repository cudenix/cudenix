import { describe, expectTypeOf, it } from "bun:test";

import type { ExtractContent } from "@/utils/types/extract-content";

describe("ExtractContent", () => {
	describe("value passthrough", () => {
		it("should pass a primitive type through unchanged", () => {
			expectTypeOf<ExtractContent<string>>().toEqualTypeOf<string>();
		});

		it("should pass a string literal through unchanged", () => {
			expectTypeOf<ExtractContent<"a">>().toEqualTypeOf<"a">();
		});

		it("should pass `bigint` through unchanged", () => {
			expectTypeOf<ExtractContent<bigint>>().toEqualTypeOf<bigint>();
		});

		it("should pass `symbol` through unchanged", () => {
			expectTypeOf<ExtractContent<symbol>>().toEqualTypeOf<symbol>();
		});

		it("should pass `null` through unchanged", () => {
			expectTypeOf<ExtractContent<null>>().toEqualTypeOf<null>();
		});

		it("should pass `undefined` through unchanged", () => {
			expectTypeOf<
				ExtractContent<undefined>
			>().toEqualTypeOf<undefined>();
		});

		it("should pass `void` through unchanged (void is not callable)", () => {
			expectTypeOf<ExtractContent<void>>().toEqualTypeOf<void>();
		});

		it("should pass an object literal through unchanged", () => {
			expectTypeOf<ExtractContent<{ a: true }>>().toEqualTypeOf<{
				a: true;
			}>();
		});

		it("should pass a tuple type through unchanged", () => {
			expectTypeOf<ExtractContent<[string, number]>>().toEqualTypeOf<
				[string, number]
			>();
		});

		it("should pass a mutable array type through unchanged", () => {
			expectTypeOf<ExtractContent<number[]>>().toEqualTypeOf<number[]>();
		});

		it("should pass a readonly array type through unchanged (arrays are not callable)", () => {
			expectTypeOf<ExtractContent<readonly number[]>>().toEqualTypeOf<
				readonly number[]
			>();
		});

		it("should pass a union of primitives through unchanged", () => {
			expectTypeOf<ExtractContent<number | boolean>>().toEqualTypeOf<
				number | boolean
			>();
		});

		it("should pass a `Promise` type through unchanged when not wrapped in a factory", () => {
			expectTypeOf<ExtractContent<Promise<string>>>().toEqualTypeOf<
				Promise<string>
			>();
		});
	});

	describe("synchronous factory", () => {
		it("should resolve to the return type of a zero-arg sync factory", () => {
			type A = () => { a: true };

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<{ a: true }>();
		});

		it("should resolve to the return type of a factory that takes args", () => {
			type A = (a: number, b: string) => boolean;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<boolean>();
		});

		it("should resolve to the return type when the factory has an optional parameter", () => {
			type A = (a?: number) => string;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		it("should resolve to the return type when the factory uses rest parameters", () => {
			type A = (...args: number[]) => string;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		it("should resolve to the literal return type when the factory yields a literal", () => {
			type A = () => 1;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<1>();
		});

		it("should resolve to `null` for a null-returning factory", () => {
			type A = () => null;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<null>();
		});

		it("should resolve to `void` for a void-returning factory", () => {
			type A = () => void;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<void>();
		});

		it("should resolve to `never` for a never-returning factory", () => {
			type A = () => never;

			expectTypeOf<ExtractContent<A>>().toBeNever();
		});

		it("should not recursively unwrap a function returned by another function", () => {
			type A = () => () => number;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<() => number>();
		});

		it("should resolve to `any` for a factory returning `any`", () => {
			type A = () => any;

			expectTypeOf<ExtractContent<A>>().toBeAny();
		});

		it("should resolve to `unknown` for a factory returning `unknown`", () => {
			type A = () => unknown;

			expectTypeOf<ExtractContent<A>>().toBeUnknown();
		});
	});

	describe("asynchronous factory", () => {
		it("should unwrap a promise returned from an async factory", () => {
			type A = () => Promise<{ a: 1 }>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<{ a: 1 }>();
		});

		it("should unwrap a `PromiseLike` returned from a factory", () => {
			type A = () => PromiseLike<string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		it("should resolve to `void` for an async factory returning `Promise<void>`", () => {
			type A = () => Promise<void>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<void>();
		});

		it("should unwrap nested promises via Awaited", () => {
			type A = () => Promise<Promise<number>>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number>();
		});

		it("should unwrap triply-nested promises via Awaited", () => {
			type A = () => Promise<Promise<Promise<number>>>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number>();
		});
	});

	describe("mixed sync and async return shapes", () => {
		it("should collapse a sync-or-async return to a single awaited type", () => {
			type A = () => string | Promise<string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		it("should preserve a union when the awaited result is itself a union", () => {
			type A = () => Promise<number | string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number | string>();
		});
	});

	describe("union distribution", () => {
		it("should distribute over a union of a value and a factory", () => {
			expectTypeOf<
				ExtractContent<string | (() => number)>
			>().toEqualTypeOf<string | number>();
		});

		it("should distribute over a union of two factories with different return types", () => {
			expectTypeOf<
				ExtractContent<(() => string) | (() => number)>
			>().toEqualTypeOf<string | number>();
		});
	});

	describe("function-shaped values", () => {
		it("should treat an object with a call signature as a factory and drop its properties", () => {
			interface A {
				a: "v1";
				(): string;
			}

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		it("should resolve to the return type of the LAST overload for an overloaded call signature", () => {
			interface A {
				(): string;
				(a: number): number;
			}

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number>();
		});

		it("should pass the built-in `Function` type through unchanged because it does not match `(...args: any[]) => infer Return`", () => {
			// biome-ignore lint/complexity/noBannedTypes: probing the built-in Function type is the point of the test
			expectTypeOf<ExtractContent<Function>>().toEqualTypeOf<Function>();
		});

		it("should pass a constructor-only type through unchanged", () => {
			class A {}

			expectTypeOf<ExtractContent<typeof A>>().toEqualTypeOf<typeof A>();
		});
	});

	describe("top, bottom and exotic types", () => {
		it("should resolve to `any` when given `any`", () => {
			expectTypeOf<ExtractContent<any>>().toBeAny();
		});

		it("should resolve to `never` when given `never`", () => {
			expectTypeOf<ExtractContent<never>>().toBeNever();
		});

		it("should resolve to `unknown` when given `unknown`", () => {
			expectTypeOf<ExtractContent<unknown>>().toBeUnknown();
		});
	});
});
