import { describe, expect, expectTypeOf, it } from "bun:test";

import { pushAll } from "@/utils/arrays/push-all";

describe("pushAll", () => {
	it.each([0, 1, 3, 4, 5, 7, 8])(
		"should append a source of length %i in order after the existing elements",
		(length) => {
			const target = [-2, -1];
			const source = Array.from({ length }, (_, i) => i);
			const snapshot = [...source];

			pushAll(target, source);

			expect(target).toStrictEqual([-2, -1, ...snapshot]);
			expect(source).toEqual(snapshot);
		},
	);

	it("should append a source too large for a variadic spread", () => {
		const length = 1_000_000;
		const target = [0];
		const source = Array.from({ length }, (_, i) => i + 1);

		pushAll(target, source);

		expect(target).toHaveLength(length + 1);
		expect(target[1]).toBe(1);
		expect(target[length]).toBe(length);
	});

	it("should append a copy of itself when the target is also the source", () => {
		const target = [1, 2, 3, 4, 5];

		pushAll(target, target);

		expect(target).toEqual([1, 2, 3, 4, 5, 1, 2, 3, 4, 5]);
	});

	it("should accept a readonly source while requiring a mutable target", () => {
		type NumberPushAll = typeof pushAll<number>;

		expectTypeOf<Parameters<NumberPushAll>[0]>().toEqualTypeOf<number[]>();
		expectTypeOf<Parameters<NumberPushAll>[1]>().toEqualTypeOf<
			readonly number[]
		>();
	});
});
