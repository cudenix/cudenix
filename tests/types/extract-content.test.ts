import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { ExtractContent } from "@/types/extract-content";

describe("ExtractContent", () => {
	describe("non-function content", () => {
		test("should pass an object literal through unchanged", () => {
			const check: ExtendsType<
				ExtractContent<{ ok: true }>,
				{ ok: true }
			> = true;

			expect(check).toBe(true);
		});

		test("should pass a primitive type through unchanged", () => {
			const check: ExtendsType<ExtractContent<string>, string> = true;

			expect(check).toBe(true);
		});

		test("should pass a string literal through unchanged", () => {
			const check: ExtendsType<ExtractContent<"foo">, "foo"> = true;

			expect(check).toBe(true);
		});

		test("should pass a union of primitives through unchanged", () => {
			const check: ExtendsType<
				ExtractContent<number | boolean>,
				number | boolean
			> = true;

			expect(check).toBe(true);
		});

		test("should pass an array type through unchanged (arrays are not callable)", () => {
			const check: ExtendsType<
				ExtractContent<readonly number[]>,
				readonly number[]
			> = true;

			expect(check).toBe(true);
		});

		test("should pass a tuple type through unchanged", () => {
			const check: ExtendsType<
				ExtractContent<[string, number]>,
				[string, number]
			> = true;

			expect(check).toBe(true);
		});

		test("should pass `null` through unchanged", () => {
			const check: ExtendsType<ExtractContent<null>, null> = true;

			expect(check).toBe(true);
		});

		test("should pass `undefined` through unchanged", () => {
			const check: ExtendsType<
				ExtractContent<undefined>,
				undefined
			> = true;

			expect(check).toBe(true);
		});

		test("should pass a mutable array type through unchanged", () => {
			const check: ExtendsType<ExtractContent<number[]>, number[]> = true;

			expect(check).toBe(true);
		});

		test("should pass `bigint` through unchanged", () => {
			const check: ExtendsType<ExtractContent<bigint>, bigint> = true;

			expect(check).toBe(true);
		});

		test("should pass `symbol` through unchanged", () => {
			const check: ExtendsType<ExtractContent<symbol>, symbol> = true;

			expect(check).toBe(true);
		});

		test("should pass a `Promise` type through unchanged when not wrapped in a factory", () => {
			const check: ExtendsType<
				ExtractContent<Promise<string>>,
				Promise<string>
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("synchronous factory", () => {
		test("should resolve to the return type of a zero-arg sync factory", () => {
			type Factory = () => { ok: true };

			const check: ExtendsType<
				ExtractContent<Factory>,
				{ ok: true }
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the return type of a factory that takes args", () => {
			type Factory = (a: number, b: string) => boolean;

			const check: ExtendsType<ExtractContent<Factory>, boolean> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the literal return type when the factory yields a literal", () => {
			type Factory = () => 42;

			const check: ExtendsType<ExtractContent<Factory>, 42> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `void` for a void-returning factory", () => {
			type Factory = () => void;

			const check: ExtendsType<ExtractContent<Factory>, void> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` for a never-returning factory", () => {
			type Factory = () => never;

			const check: ExtendsType<ExtractContent<Factory>, never> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `null` for a null-returning factory", () => {
			type Factory = () => null;

			const check: ExtendsType<ExtractContent<Factory>, null> = true;

			expect(check).toBe(true);
		});

		test("should not recursively unwrap a function returned by another function", () => {
			type Factory = () => () => number;

			const check: ExtendsType<
				ExtractContent<Factory>,
				() => number
			> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the return type when the factory uses rest parameters", () => {
			type Factory = (...args: number[]) => string;

			const check: ExtendsType<ExtractContent<Factory>, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the return type when the factory has an optional parameter", () => {
			type Factory = (a?: number) => string;

			const check: ExtendsType<ExtractContent<Factory>, string> = true;

			expect(check).toBe(true);
		});
	});

	describe("asynchronous factory", () => {
		test("should unwrap a promise returned from an async factory", () => {
			type Factory = () => Promise<{ ok: 1 }>;

			const check: ExtendsType<ExtractContent<Factory>, { ok: 1 }> = true;

			expect(check).toBe(true);
		});

		test("should unwrap a promise from a synchronous function that returns a promise", () => {
			type Factory = () => Promise<string>;

			const check: ExtendsType<ExtractContent<Factory>, string> = true;

			expect(check).toBe(true);
		});

		test("should unwrap nested promises via Awaited", () => {
			type Factory = () => Promise<Promise<number>>;

			const check: ExtendsType<ExtractContent<Factory>, number> = true;

			expect(check).toBe(true);
		});

		test("should unwrap triply-nested promises via Awaited", () => {
			type Factory = () => Promise<Promise<Promise<number>>>;

			const check: ExtendsType<ExtractContent<Factory>, number> = true;

			expect(check).toBe(true);
		});

		test("should unwrap a `PromiseLike` returned from a factory", () => {
			type Factory = () => PromiseLike<string>;

			const check: ExtendsType<ExtractContent<Factory>, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `void` for an async factory returning `Promise<void>`", () => {
			type Factory = () => Promise<void>;

			const check: ExtendsType<ExtractContent<Factory>, void> = true;

			expect(check).toBe(true);
		});
	});

	describe("mixed return shapes", () => {
		test("should preserve a union of awaited values when the factory may return sync or async", () => {
			type Factory = () => string | Promise<string>;

			const check: ExtendsType<ExtractContent<Factory>, string> = true;

			expect(check).toBe(true);
		});

		test("should preserve a union when the awaited result is itself a union", () => {
			type Factory = () => Promise<number | string>;

			const check: ExtendsType<
				ExtractContent<Factory>,
				number | string
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to `any` when given `any`", () => {
			const check: ExtendsType<ExtractContent<any>, any> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` when given `never`", () => {
			const check: ExtendsType<ExtractContent<never>, never> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `unknown` when given `unknown`", () => {
			const check: ExtendsType<ExtractContent<unknown>, unknown> = true;

			expect(check).toBe(true);
		});
	});

	describe("union distribution", () => {
		test("should distribute over a union of a value and a factory", () => {
			const check: ExtendsType<
				ExtractContent<string | (() => number)>,
				string | number
			> = true;

			expect(check).toBe(true);
		});

		test("should distribute over a union of two factories with different return types", () => {
			const check: ExtendsType<
				ExtractContent<(() => string) | (() => number)>,
				string | number
			> = true;

			expect(check).toBe(true);
		});
	});

	describe("function-shaped values", () => {
		test("should treat an object with a call signature as a factory and drop its properties", () => {
			interface Callable {
				meta: "foo";
				(): string;
			}

			const check: ExtendsType<ExtractContent<Callable>, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `any` for the built-in `Function` type", () => {
			// biome-ignore lint/complexity/noBannedTypes: probing the built-in Function type is the point of the test
			const check: ExtendsType<ExtractContent<Function>, any> = true;

			expect(check).toBe(true);
		});

		test("should pass a constructor-only type through unchanged", () => {
			class Foo {}

			const check: ExtendsType<
				ExtractContent<typeof Foo>,
				typeof Foo
			> = true;

			expect(check).toBe(true);
		});
	});
});
