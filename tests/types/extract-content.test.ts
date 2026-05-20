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
			expectTypeOf<ExtractContent<{ ok: true }>>().toEqualTypeOf<{
				ok: true;
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
			expectTypeOf<
				ExtractContent<readonly number[]>
			>().toEqualTypeOf<readonly number[]>();
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
			type Factory = () => { ok: true };

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<{
				ok: true;
			}>();
		});

		test("should resolve to the return type of a factory that takes args", () => {
			type Factory = (a: number, b: string) => boolean;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<boolean>();
		});

		test("should resolve to the return type when the factory has an optional parameter", () => {
			type Factory = (a?: number) => string;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<string>();
		});

		test("should resolve to the return type when the factory uses rest parameters", () => {
			type Factory = (...args: number[]) => string;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<string>();
		});

		test("should resolve to the literal return type when the factory yields a literal", () => {
			type Factory = () => 42;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<42>();
		});

		test("should resolve to `null` for a null-returning factory", () => {
			type Factory = () => null;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<null>();
		});

		test("should resolve to `void` for a void-returning factory", () => {
			type Factory = () => void;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<void>();
		});

		test("should resolve to `never` for a never-returning factory", () => {
			type Factory = () => never;

			expectTypeOf<ExtractContent<Factory>>().toBeNever();
		});

		test("should not recursively unwrap a function returned by another function", () => {
			type Factory = () => () => number;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<
				() => number
			>();
		});
	});

	describe("asynchronous factory", () => {
		test("should unwrap a promise returned from an async factory", () => {
			type Factory = () => Promise<{ ok: 1 }>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<{
				ok: 1;
			}>();
		});

		test("should unwrap a promise from a synchronous function that returns a promise", () => {
			type Factory = () => Promise<string>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<string>();
		});

		test("should unwrap a `PromiseLike` returned from a factory", () => {
			type Factory = () => PromiseLike<string>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<string>();
		});

		test("should resolve to `void` for an async factory returning `Promise<void>`", () => {
			type Factory = () => Promise<void>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<void>();
		});

		test("should unwrap nested promises via Awaited", () => {
			type Factory = () => Promise<Promise<number>>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<number>();
		});

		test("should unwrap triply-nested promises via Awaited", () => {
			type Factory = () => Promise<Promise<Promise<number>>>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<number>();
		});
	});

	describe("mixed sync and async return shapes", () => {
		test("should preserve a union of awaited values when the factory may return sync or async", () => {
			type Factory = () => string | Promise<string>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<string>();
		});

		test("should preserve a union when the awaited result is itself a union", () => {
			type Factory = () => Promise<number | string>;

			expectTypeOf<ExtractContent<Factory>>().toEqualTypeOf<
				number | string
			>();
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
			interface Callable {
				meta: "foo";
				(): string;
			}

			expectTypeOf<ExtractContent<Callable>>().toEqualTypeOf<string>();
		});

		test("should pass the built-in `Function` type through unchanged because it does not match `(...args: any[]) => infer Return`", () => {
			// biome-ignore lint/complexity/noBannedTypes: probing the built-in Function type is the point of the test
			expectTypeOf<ExtractContent<Function>>().toEqualTypeOf<Function>();
		});

		test("should pass a constructor-only type through unchanged", () => {
			class Foo {}

			expectTypeOf<ExtractContent<typeof Foo>>().toEqualTypeOf<
				typeof Foo
			>();
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
