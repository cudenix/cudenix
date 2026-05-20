import { describe, expect, test } from "bun:test";

import type { ExtendsType } from "@/types/extends-type";
import type { ExtractContent } from "@/types/extract-content";

describe("ExtractContent", () => {
	describe("value passthrough", () => {
		test("should pass a primitive type through unchanged", () => {
			type Result = ExtractContent<string>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should pass a string literal through unchanged", () => {
			type Result = ExtractContent<"foo">;

			const check: ExtendsType<Result, "foo"> = true;

			expect(check).toBe(true);
		});

		test("should pass `bigint` through unchanged", () => {
			type Result = ExtractContent<bigint>;

			const check: ExtendsType<Result, bigint> = true;

			expect(check).toBe(true);
		});

		test("should pass `symbol` through unchanged", () => {
			type Result = ExtractContent<symbol>;

			const check: ExtendsType<Result, symbol> = true;

			expect(check).toBe(true);
		});

		test("should pass `null` through unchanged", () => {
			type Result = ExtractContent<null>;

			const check: ExtendsType<Result, null> = true;

			expect(check).toBe(true);
		});

		test("should pass `undefined` through unchanged", () => {
			type Result = ExtractContent<undefined>;

			const check: ExtendsType<Result, undefined> = true;

			expect(check).toBe(true);
		});

		test("should pass `void` through unchanged (void is not callable)", () => {
			type Result = ExtractContent<void>;

			const check: ExtendsType<Result, void> = true;

			expect(check).toBe(true);
		});

		test("should pass an object literal through unchanged", () => {
			type Result = ExtractContent<{ ok: true }>;

			const check: ExtendsType<Result, { ok: true }> = true;

			expect(check).toBe(true);
		});

		test("should pass a tuple type through unchanged", () => {
			type Result = ExtractContent<[string, number]>;

			const check: ExtendsType<Result, [string, number]> = true;

			expect(check).toBe(true);
		});

		test("should pass a mutable array type through unchanged", () => {
			type Result = ExtractContent<number[]>;

			const check: ExtendsType<Result, number[]> = true;

			expect(check).toBe(true);
		});

		test("should pass a readonly array type through unchanged (arrays are not callable)", () => {
			type Result = ExtractContent<readonly number[]>;

			const check: ExtendsType<Result, readonly number[]> = true;

			expect(check).toBe(true);
		});

		test("should pass a union of primitives through unchanged", () => {
			type Result = ExtractContent<number | boolean>;

			const check: ExtendsType<Result, number | boolean> = true;

			expect(check).toBe(true);
		});

		test("should pass a `Promise` type through unchanged when not wrapped in a factory", () => {
			type Result = ExtractContent<Promise<string>>;

			const check: ExtendsType<Result, Promise<string>> = true;

			expect(check).toBe(true);
		});
	});

	describe("synchronous factory", () => {
		test("should resolve to the return type of a zero-arg sync factory", () => {
			type Factory = () => { ok: true };

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, { ok: true }> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the return type of a factory that takes args", () => {
			type Factory = (a: number, b: string) => boolean;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, boolean> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the return type when the factory has an optional parameter", () => {
			type Factory = (a?: number) => string;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the return type when the factory uses rest parameters", () => {
			type Factory = (...args: number[]) => string;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to the literal return type when the factory yields a literal", () => {
			type Factory = () => 42;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, 42> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `null` for a null-returning factory", () => {
			type Factory = () => null;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, null> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `void` for a void-returning factory", () => {
			type Factory = () => void;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, void> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` for a never-returning factory", () => {
			type Factory = () => never;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, never> = true;

			expect(check).toBe(true);
		});

		test("should not recursively unwrap a function returned by another function", () => {
			type Factory = () => () => number;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, () => number> = true;

			expect(check).toBe(true);
		});
	});

	describe("asynchronous factory", () => {
		test("should unwrap a promise returned from an async factory", () => {
			type Factory = () => Promise<{ ok: 1 }>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, { ok: 1 }> = true;

			expect(check).toBe(true);
		});

		test("should unwrap a promise from a synchronous function that returns a promise", () => {
			type Factory = () => Promise<string>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should unwrap a `PromiseLike` returned from a factory", () => {
			type Factory = () => PromiseLike<string>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `void` for an async factory returning `Promise<void>`", () => {
			type Factory = () => Promise<void>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, void> = true;

			expect(check).toBe(true);
		});

		test("should unwrap nested promises via Awaited", () => {
			type Factory = () => Promise<Promise<number>>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, number> = true;

			expect(check).toBe(true);
		});

		test("should unwrap triply-nested promises via Awaited", () => {
			type Factory = () => Promise<Promise<Promise<number>>>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, number> = true;

			expect(check).toBe(true);
		});
	});

	describe("mixed sync and async return shapes", () => {
		test("should preserve a union of awaited values when the factory may return sync or async", () => {
			type Factory = () => string | Promise<string>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should preserve a union when the awaited result is itself a union", () => {
			type Factory = () => Promise<number | string>;

			type Result = ExtractContent<Factory>;

			const check: ExtendsType<Result, number | string> = true;

			expect(check).toBe(true);
		});
	});

	describe("union distribution", () => {
		test("should distribute over a union of a value and a factory", () => {
			type Result = ExtractContent<string | (() => number)>;

			const check: ExtendsType<Result, string | number> = true;

			expect(check).toBe(true);
		});

		test("should distribute over a union of two factories with different return types", () => {
			type Result = ExtractContent<(() => string) | (() => number)>;

			const check: ExtendsType<Result, string | number> = true;

			expect(check).toBe(true);
		});
	});

	describe("function-shaped values", () => {
		test("should treat an object with a call signature as a factory and drop its properties", () => {
			interface Callable {
				meta: "foo";
				(): string;
			}

			type Result = ExtractContent<Callable>;

			const check: ExtendsType<Result, string> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `any` for the built-in `Function` type", () => {
			// biome-ignore lint/complexity/noBannedTypes: probing the built-in Function type is the point of the test
			type Result = ExtractContent<Function>;

			const check: ExtendsType<Result, any> = true;

			expect(check).toBe(true);
		});

		test("should pass a constructor-only type through unchanged", () => {
			class Foo {}

			type Result = ExtractContent<typeof Foo>;

			const check: ExtendsType<Result, typeof Foo> = true;

			expect(check).toBe(true);
		});
	});

	describe("top, bottom and exotic types", () => {
		test("should resolve to `any` when given `any`", () => {
			type Result = ExtractContent<any>;

			const check: ExtendsType<Result, any> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `never` when given `never`", () => {
			type Result = ExtractContent<never>;

			const check: ExtendsType<Result, never> = true;

			expect(check).toBe(true);
		});

		test("should resolve to `unknown` when given `unknown`", () => {
			type Result = ExtractContent<unknown>;

			const check: ExtendsType<Result, unknown> = true;

			expect(check).toBe(true);
		});
	});
});
