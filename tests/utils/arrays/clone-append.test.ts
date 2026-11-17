import { describe, expect, expectTypeOf, it } from "bun:test";

import { cloneAppend } from "@/utils/arrays/clone-append";

describe("cloneAppend", () => {
	it.each([0, 1, 2, 3, 4, 5])(
		"should return a new array with the item appended to a source of length %i",
		(length) => {
			const source = Array.from({ length }, (_, i) => ({ a: i }));
			const snapshot = [...source];
			const item = { a: length };

			const result = cloneAppend(source, item);

			expect(result).not.toBe(source);
			expect(result).toHaveLength(length + 1);
			expect(result[length]).toBe(item);

			for (let i = 0; i < length; i++) {
				expect(result[i]).toBe(snapshot[i]);
				expect(source[i]).toBe(snapshot[i]);
			}

			expect(source).toHaveLength(length);
		},
	);

	it("should accept a readonly source and return a mutable array", () => {
		expectTypeOf<Parameters<typeof cloneAppend<number>>[0]>().toEqualTypeOf<
			readonly number[]
		>();
		expectTypeOf(cloneAppend([1, 2] as const, 3)).toEqualTypeOf<
			(1 | 2 | 3)[]
		>();
	});
});
