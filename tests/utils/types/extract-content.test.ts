import { describe, expectTypeOf, test } from "bun:test";

import type { ExtractContent } from "@/types/extract-content";

describe("ExtractContent", () => {
	describe("value passthrough", () => {
		test("should pass a primitive type through unchanged", () => {
			expectTypeOf<ExtractContent<string>>().toEqualTypeOf<string>();
		});

		test("should pass a string literal through unchanged", () => {
			expectTypeOf<ExtractContent<"foo">>().toEqualTypeOf<"foo">();
		});

		test("should pass `bigint` through unchanged", () => {
			expectTypeOf<ExtractContent<bigint>>().toEqualTypeOf<bigint>();
		});

		test("should pass `symbol` through unchanged", () => {
			expectTypeOf<ExtractContent<symbol>>().toEqualTypeOf<symbol>();
		});

		test("should pass `null` through unchanged", () => {
			expectTypeOf<ExtractContent<null>>().toEqualTypeOf<null>();
		});

		test("should pass `undefined` through unchanged", () => {
			expectTypeOf<
				ExtractContent<undefined>
			>().toEqualTypeOf<undefined>();
		});

		test("should pass `void` through unchanged (void is not callable)", () => {
			expectTypeOf<ExtractContent<void>>().toEqualTypeOf<void>();
		});

		test("should pass an object literal through unchanged", () => {
			expectTypeOf<ExtractContent<{ a: true }>>().toEqualTypeOf<{
				a: true;
			}>();
		});

		test("should pass a tuple type through unchanged", () => {
			expectTypeOf<ExtractContent<[string, number]>>().toEqualTypeOf<
				[string, number]
			>();
		});

		test("should pass a mutable array type through unchanged", () => {
			expectTypeOf<ExtractContent<number[]>>().toEqualTypeOf<number[]>();
		});

		test("should pass a readonly array type through unchanged (arrays are not callable)", () => {
			expectTypeOf<ExtractContent<readonly number[]>>().toEqualTypeOf<
				readonly number[]
			>();
		});

		test("should pass a union of primitives through unchanged", () => {
			expectTypeOf<ExtractContent<number | boolean>>().toEqualTypeOf<
				number | boolean
			>();
		});

		test("should pass a `Promise` type through unchanged when not wrapped in a factory", () => {
			expectTypeOf<ExtractContent<Promise<string>>>().toEqualTypeOf<
				Promise<string>
			>();
		});
	});

	describe("synchronous factory", () => {
		test("should resolve to the return type of a zero-arg sync factory", () => {
			type A = () => { a: true };

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<{ a: true }>();
		});

		test("should resolve to the return type of a factory that takes args", () => {
			type A = (a: number, b: string) => boolean;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<boolean>();
		});

		test("should resolve to the return type when the factory has an optional parameter", () => {
			type A = (a?: number) => string;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		test("should resolve to the return type when the factory uses rest parameters", () => {
			type A = (...args: number[]) => string;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		test("should resolve to the literal return type when the factory yields a literal", () => {
			type A = () => 42;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<42>();
		});

		test("should resolve to `null` for a null-returning factory", () => {
			type A = () => null;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<null>();
		});

		test("should resolve to `void` for a void-returning factory", () => {
			type A = () => void;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<void>();
		});

		test("should resolve to `never` for a never-returning factory", () => {
			type A = () => never;

			expectTypeOf<ExtractContent<A>>().toBeNever();
		});

		test("should not recursively unwrap a function returned by another function", () => {
			type A = () => () => number;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<() => number>();
		});
	});

	describe("asynchronous factory", () => {
		test("should unwrap a promise returned from an async factory", () => {
			type A = () => Promise<{ a: 1 }>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<{ a: 1 }>();
		});

		test("should unwrap a promise from a synchronous function that returns a promise", () => {
			type A = () => Promise<string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		test("should unwrap a `PromiseLike` returned from a factory", () => {
			type A = () => PromiseLike<string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		test("should resolve to `void` for an async factory returning `Promise<void>`", () => {
			type A = () => Promise<void>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<void>();
		});

		test("should unwrap nested promises via Awaited", () => {
			type A = () => Promise<Promise<number>>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number>();
		});

		test("should unwrap triply-nested promises via Awaited", () => {
			type A = () => Promise<Promise<Promise<number>>>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number>();
		});
	});

	describe("mixed sync and async return shapes", () => {
		test("should preserve a union of awaited values when the factory may return sync or async", () => {
			type A = () => string | Promise<string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		test("should preserve a union when the awaited result is itself a union", () => {
			type A = () => Promise<number | string>;

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<number | string>();
		});
	});

	describe("union distribution", () => {
		test("should distribute over a union of a value and a factory", () => {
			expectTypeOf<
				ExtractContent<string | (() => number)>
			>().toEqualTypeOf<string | number>();
		});

		test("should distribute over a union of two factories with different return types", () => {
			expectTypeOf<
				ExtractContent<(() => string) | (() => number)>
			>().toEqualTypeOf<string | number>();
		});
	});

	describe("function-shaped values", () => {
		test("should treat an object with a call signature as a factory and drop its properties", () => {
			interface A {
				a: "v1";
				(): string;
			}

			expectTypeOf<ExtractContent<A>>().toEqualTypeOf<string>();
		});

		test("should pass the built-in `Function` type through unchanged because it does not match `(...args: any[]) => infer Return`", () => {
			// biome-ignore lint/complexity/noBannedTypes: probing the built-in Function type is the point of the test
			expectTypeOf<ExtractContent<Function>>().toEqualTypeOf<Function>();
		});

		test("should pass a constructor-only type through unchanged", () => {
			class A {}

			expectTypeOf<ExtractContent<typeof A>>().toEqualTypeOf<typeof A>();
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to `any` when given `any`", () => {
			expectTypeOf<ExtractContent<any>>().toBeAny();
		});

		test("should resolve to `never` when given `never`", () => {
			expectTypeOf<ExtractContent<never>>().toBeNever();
		});

		test("should resolve to `unknown` when given `unknown`", () => {
			expectTypeOf<ExtractContent<unknown>>().toBeUnknown();
		});
	});
});
