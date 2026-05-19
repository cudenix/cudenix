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
});
