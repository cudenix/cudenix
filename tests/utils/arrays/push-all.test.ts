import { beforeEach, describe, expect, expectTypeOf, it } from "bun:test";

import { pushAll } from "@/utils/arrays/push-all";

describe("pushAll", () => {
	describe("happy path", () => {
		it("should append all elements of source to target in order", () => {
			const target = [1, 2];

			pushAll(target, [3, 4, 5]);

			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		it("should append a single element to a non-empty target", () => {
			const target = [1, 2];

			pushAll(target, [3]);

			expect(target).toEqual([1, 2, 3]);
		});
	});

	describe("return value contract", () => {
		it("should return undefined (void contract)", () => {
			const target: number[] = [];

			expect(pushAll(target, [1, 2])).toBeUndefined();
			expect(target).toEqual([1, 2]);
		});
	});

	describe("in-place mutation", () => {
		let target: number[];
		let source: number[];

		beforeEach(() => {
			target = [1, 2];
			source = [3, 4, 5];
		});

		it("should mutate the provided target", () => {
			pushAll(target, source);

			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		it("should not mutate the source array", () => {
			const snapshot = [...source];

			pushAll(target, source);

			expect(source).toEqual(snapshot);
		});
	});

	describe("readonly source", () => {
		it("should accept a readonly tuple while keeping the target mutable", () => {
			type NumberPushAll = typeof pushAll<number>;

			const target = [1];

			pushAll<number>(target, [2, 3] as const);

			expectTypeOf<Parameters<NumberPushAll>[0]>().toEqualTypeOf<
				number[]
			>();
			expectTypeOf<Parameters<NumberPushAll>[1]>().toEqualTypeOf<
				readonly number[]
			>();
			target.push(4);
			expect(target).toEqual([1, 2, 3, 4]);
		});

		it("should append from a frozen source without a cast", () => {
			const target = [1];
			const source: readonly number[] = Object.freeze([2, 3]);

			pushAll(target, source);

			expect(target).toEqual([1, 2, 3]);
			expect(source).toEqual([2, 3]);
			expect(Object.isFrozen(source)).toBe(true);
		});
	});

	describe("element preservation", () => {
		it("should preserve duplicates from source", () => {
			const target = ["v1"];

			pushAll(target, ["v2", "v2", "v3"]);

			expect(target).toEqual(["v1", "v2", "v2", "v3"]);
		});

		it("should preserve element identity for objects appended from source", () => {
			const a = { a: 1 };
			const b = { a: 2 };
			const target: object[] = [];

			pushAll(target, [a, b]);

			expect(target[0]).toBe(a);
			expect(target[1]).toBe(b);
		});

		it("should preserve identity of pre-existing target elements", () => {
			const a = { a: "v1" };
			const b = { a: "v2" };
			const c = { a: "v3" };
			const target: object[] = [a, b];

			pushAll(target, [c]);

			expect(target[0]).toBe(a);
			expect(target[1]).toBe(b);
			expect(target[2]).toBe(c);
		});

		it("should support mixing element types under a union generic", () => {
			const target: (number | string)[] = [1];

			pushAll<number | string>(target, ["v1", 3]);

			expect(target).toEqual([1, "v1", 3]);
		});

		it("should append null and undefined values without coercion", () => {
			const target: (null | number | undefined)[] = [0];

			pushAll(target, [null, undefined, 1]);

			expect(target).toEqual([0, null, undefined, 1]);
		});
	});

	describe("length and positioning", () => {
		it("should set the final length to base + source length", () => {
			const target = [1, 2, 3];

			pushAll(target, [4, 5, 6, 7]);

			expect(target).toHaveLength(7);
		});

		it("should write the first appended element exactly at target[baseLength]", () => {
			const target = [1, 2, 3];
			const baseLength = target.length;
			const source = [4, 5, 6];

			pushAll(target, source);

			expect(target[baseLength]).toBe(4);
			expect(target[baseLength + source.length - 1]).toBe(6);
		});

		it("should append a source large enough to overflow a variadic spread", () => {
			const length = 1_000_000;
			const target = [0];
			const source = Array.from({ length }, (_, i) => i + 1);

			pushAll(target, source);

			expect(target).toHaveLength(length + 1);
			expect(target[0]).toBe(0);
			expect(target[1]).toBe(1);
			expect(target[length]).toBe(length);
		});
	});

	describe("empty-array edge cases", () => {
		it("should be a no-op when source is empty", () => {
			const target = [1, 2, 3];
			const snapshot = [...target];

			pushAll(target, []);

			expect(target).toEqual(snapshot);
		});

		it("should become a copy of source when target is empty", () => {
			const target: number[] = [];

			pushAll(target, [1, 2, 3]);

			expect(target).toEqual([1, 2, 3]);
		});

		it("should be a no-op when both target and source are empty", () => {
			const target: number[] = [];

			pushAll(target, []);

			expect(target).toEqual([]);
			expect(target).toHaveLength(0);
		});
	});

	describe("sparse source", () => {
		it("should materialize holes in source as undefined entries (no hole carry-over)", () => {
			const target: (number | undefined)[] = [0];
			const source = new Array<number | undefined>(3);

			source[0] = 1;
			source[2] = 3;

			pushAll(target, source);

			expect(1 in source).toBe(false);
			expect(target).toHaveLength(4);
			expect(target[0]).toBe(0);
			expect(target[1]).toBe(1);
			expect(target[2]).toBeUndefined();
			expect(target[3]).toBe(3);
			expect(2 in target).toBe(true);
		});
	});

	describe("aliasing (target === source)", () => {
		it("should snapshot the source length before writing to avoid infinite growth", () => {
			const target = [1, 2, 3];

			pushAll(target, target);

			expect(target).toEqual([1, 2, 3, 1, 2, 3]);
			expect(target).toHaveLength(6);
		});
	});

	describe("maximum array length overflow", () => {
		it("should throw a RangeError and leave the target unchanged when the combined length exceeds the max array length", () => {
			const maxLength = 2 ** 32 - 2;
			const target = new Array<number>(maxLength);

			expect(() => pushAll(target, [1, 2, 3])).toThrow(RangeError);
			expect(target).toHaveLength(maxLength);
			expect(0 in target).toBe(false);
			expect(maxLength - 1 in target).toBe(false);
		});
	});

	describe("maximum array length boundary", () => {
		it("should append when the combined length equals the max array length", () => {
			const maxLength = 2 ** 32 - 1;
			const target = new Array<number>(maxLength - 1);

			pushAll(target, [1]);

			expect(target).toHaveLength(maxLength);
			expect(target[maxLength - 1]).toBe(1);
		});

		it("should throw a RangeError before any write when only part of the source fits", () => {
			const maxLength = 2 ** 32 - 1;
			const target = new Array<number>(maxLength - 2);

			expect(() => pushAll(target, [1, 2, 3])).toThrow(RangeError);
			expect(target).toHaveLength(maxLength - 2);
			expect(maxLength - 2 in target).toBe(false);
		});
	});

	describe("source sizes", () => {
		it.each([
			0, 1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 127,
			128, 129, 255, 256, 257, 1023, 1024, 1025, 4095, 4096, 4097, 65_535,
			65_536, 65_537, 130_000,
		])("should append a source of length %i in order", (length) => {
			const target = [-2, -1];
			const source = Array.from({ length }, (_, i) => i);

			pushAll(target, source);

			expect(target).toHaveLength(length + 2);
			expect(target[0]).toBe(-2);
			expect(target[1]).toBe(-1);

			for (let i = 0; i < length; i++) {
				if (target[i + 2] !== i) {
					throw new Error(`mismatch at index ${i}`);
				}
			}
		});

		it("should append across repeated calls on the same target", () => {
			const target: number[] = [];
			const expected: number[] = [];

			for (let length = 0; length < 40; length++) {
				const source = Array.from(
					{ length },
					(_, i) => length * 100 + i,
				);

				pushAll(target, source);
				expected.push(...source);
			}

			expect(target).toEqual(expected);
		});
	});

	describe("element kinds", () => {
		it("should append nested arrays as elements without flattening", () => {
			const a = [1, 2];
			const b: number[] = [];
			const target: number[][] = [];

			pushAll(target, [a, b]);

			expect(target).toHaveLength(2);
			expect(target[0]).toBe(a);
			expect(target[1]).toBe(b);
		});

		it("should append doubles and objects to an integer target", () => {
			const a = { a: 1 };
			const target: unknown[] = [1, 2];

			pushAll(target, [1.5, Number.NaN, -0, a, "v1"]);

			expect(target).toHaveLength(7);
			expect(target[2]).toBe(1.5);
			expect(target[3]).toBeNaN();
			expect(Object.is(target[4], -0)).toBe(true);
			expect(target[5]).toBe(a);
			expect(target[6]).toBe("v1");
		});
	});

	describe("sparse arrays", () => {
		it("should keep holes in the target and append after its length", () => {
			const target = new Array<number>(3);

			target[1] = 1;

			pushAll(target, [2, 3]);

			expect(target).toHaveLength(5);
			expect(0 in target).toBe(false);
			expect(2 in target).toBe(false);
			expect(target[1]).toBe(1);
			expect(target[3]).toBe(2);
			expect(target[4]).toBe(3);
		});

		it("should materialize a source made only of holes", () => {
			const target: (number | undefined)[] = [];

			pushAll(target, new Array<number | undefined>(3));

			expect(target).toHaveLength(3);
			expect(0 in target).toBe(true);
			expect(2 in target).toBe(true);
			expect(target[1]).toBeUndefined();
		});

		it("should materialize trailing holes of the source", () => {
			const target: (number | undefined)[] = [0];
			const source: (number | undefined)[] = [1];

			source.length = 3;

			pushAll(target, source);

			expect(target).toHaveLength(4);
			expect(target[1]).toBe(1);
			expect(3 in target).toBe(true);
			expect(target[3]).toBeUndefined();
		});
	});

	describe("non-extensible targets", () => {
		it("should throw a TypeError and leave a non-extensible target unchanged", () => {
			const target = Object.preventExtensions([1, 2]);

			expect(() => pushAll(target, [3, 4])).toThrow(TypeError);
			expect(target).toHaveLength(2);
			expect(target).toEqual([1, 2]);
		});

		it("should be a no-op on a frozen target when source is empty", () => {
			const target = Object.freeze([1, 2]) as number[];

			expect(() => pushAll(target, [])).not.toThrow();
			expect(target).toEqual([1, 2]);
		});

		it("should be a no-op on a sealed target when source is empty", () => {
			const target = Object.seal([1, 2]);

			expect(() => pushAll(target, [])).not.toThrow();
			expect(target).toHaveLength(2);
		});
	});

	describe("frozen and sealed targets", () => {
		it("should throw a TypeError and leave a frozen target unchanged", () => {
			const target = Object.freeze([1, 2]) as number[];

			expect(() => pushAll(target, [3, 4])).toThrow(TypeError);
			expect(target).toEqual([1, 2]);
			expect(target).toHaveLength(2);
		});

		it("should throw a TypeError and leave a sealed target unchanged", () => {
			const target = Object.seal([1, 2]);

			expect(() => pushAll(target, [3, 4])).toThrow(TypeError);
			expect(target).toHaveLength(2);
			expect(Object.keys(target)).toEqual(["0", "1"]);
			expect(target[0]).toBe(1);
			expect(target[1]).toBe(2);
		});
	});
});
