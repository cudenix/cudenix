import { describe, expectTypeOf, it } from "bun:test";

import type { Prettify } from "@/utils/types/prettify";

describe("Prettify", () => {
	it("should materialize an intersection into one object type", () => {
		expectTypeOf<Prettify<{ a: string } & { b: number }>>().toEqualTypeOf<{
			a: string;
			b: number;
		}>();
	});

	it("should preserve optional and readonly modifiers", () => {
		expectTypeOf<
			Prettify<{ readonly a: string } & { b?: number }>
		>().branded.toEqualTypeOf<{ readonly a: string; b?: number }>();
	});

	it("should preserve object unions", () => {
		expectTypeOf<Prettify<{ a: string } | { b: number }>>().toEqualTypeOf<
			{ a: string } | { b: number }
		>();
	});

	it("should reject non-object inputs", () => {
		// @ts-expect-error - string does not satisfy `T extends object`
		type _A = Prettify<string>;
		// @ts-expect-error - undefined does not satisfy `T extends object`
		type _B = Prettify<undefined>;
	});
});
