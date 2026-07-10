import { beforeEach, describe, expect, it } from "bun:test";

import { pushAllFrom } from "@/utils/arrays/push-all-from";

describe("pushAllFrom", () => {
	describe("happy path", () => {
		it("should append only the source tail starting at `start`", () => {
			const target = [1, 2];

			pushAllFrom(target, [9, 9, 3, 4], 2);

			expect(target).toEqual([1, 2, 3, 4]);
		});

		it("should append the whole source when start is 0", () => {
			const target = [1, 2];

			pushAllFrom(target, [3, 4, 5], 0);

			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		it("should append a single trailing element when start is the last index", () => {
			const target = [1, 2];

			pushAllFrom(target, [9, 9, 3], 2);

			expect(target).toEqual([1, 2, 3]);
		});
	});

	describe("return value contract", () => {
		it("should return undefined (void contract)", () => {
			const target: number[] = [];

			const result = pushAllFrom(target, [1, 2], 0);

			expect(result).toBeUndefined();
		});
	});

	describe("in-place mutation", () => {
		let target: number[];
		let source: number[];

		beforeEach(() => {
			target = [1, 2];
			source = [9, 3, 4, 5];
		});

		it("should mutate the target in place (same reference)", () => {
			const before = target;

			pushAllFrom(target, source, 1);

			expect(target).toBe(before);
			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		it("should not mutate the source array", () => {
			const snapshot = [...source];

			pushAllFrom(target, source, 1);

			expect(source).toEqual(snapshot);
		});
	});

	describe("element preservation", () => {
		it("should preserve duplicates from the source tail", () => {
			const target = ["a"];

			pushAllFrom(target, ["x", "b", "b", "c"], 1);

			expect(target).toEqual(["a", "b", "b", "c"]);
		});

		it("should preserve element identity for objects appended from source", () => {
			const a = { a: 1 };
			const b = { a: 2 };
			const target: object[] = [];

			pushAllFrom(target, [{ a: 0 }, a, b], 1);

			expect(target[0]).toBe(a);
			expect(target[1]).toBe(b);
		});

		it("should preserve identity of pre-existing target elements", () => {
			const x = { a: "v1" };
			const y = { a: "v2" };
			const z = { a: "v3" };
			const target: object[] = [x, y];

			pushAllFrom(target, [{ a: "skip" }, z], 1);

			expect(target[0]).toBe(x);
			expect(target[1]).toBe(y);
			expect(target[2]).toBe(z);
		});

		it("should support mixing element types under a union generic", () => {
			const target: (number | string)[] = [1];

			pushAllFrom<number | string>(target, [0, "v1", 3], 1);

			expect(target).toEqual([1, "v1", 3]);
		});

		it("should append null and undefined values without coercion", () => {
			const target: (number | null | undefined)[] = [0];

			pushAllFrom(target, [9, null, undefined, 1], 1);

			expect(target).toEqual([0, null, undefined, 1]);
		});
	});

	describe("length and positioning", () => {
		it("should set the final length to base + (source length - start)", () => {
			const target = [1, 2, 3];

			pushAllFrom(target, [9, 9, 4, 5, 6, 7], 2);

			expect(target).toHaveLength(7);
		});

		it("should write the first appended element exactly at target[baseLength]", () => {
			const target = [1, 2, 3];
			const baseLength = target.length;

			pushAllFrom(target, [9, 4, 5, 6], 1);

			expect(target[baseLength]).toBe(4);
			expect(target[baseLength + 2]).toBe(6);
		});

		it("should append a tail large enough to overflow a variadic spread", () => {
			const length = 1_000_000;
			const target = [0];
			const source = Array.from({ length: length + 1 }, (_, i) => i);

			expect(() => {
				const probe: number[] = [];

				probe.push(...source.slice(1));
			}).toThrow(RangeError);

			pushAllFrom(target, source, 1);

			expect(target).toHaveLength(length + 1);
			expect(target[0]).toBe(0);
			expect(target[1]).toBe(1);
			expect(target[length]).toBe(length);
		});
	});

	describe("no-op edge cases (count <= 0)", () => {
		it("should be a no-op when start equals the source length", () => {
			const target = [1, 2, 3];
			const snapshot = [...target];

			pushAllFrom(target, [4, 5], 2);

			expect(target).toEqual(snapshot);
			expect(target).toHaveLength(3);
		});

		it("should be a no-op when start is past the source length", () => {
			const target = [1, 2, 3];
			const snapshot = [...target];

			pushAllFrom(target, [4, 5], 5);

			expect(target).toEqual(snapshot);
		});

		it("should be a no-op when the source is empty", () => {
			const target = [1, 2, 3];
			const snapshot = [...target];

			pushAllFrom(target, [], 0);

			expect(target).toEqual(snapshot);
		});

		it("should be a no-op when both target and source are empty", () => {
			const target: number[] = [];

			pushAllFrom(target, [], 0);

			expect(target).toEqual([]);
			expect(target).toHaveLength(0);
		});
	});

	describe("negative start (no lower-bound clamp)", () => {
		it("should read out of bounds and materialize undefined entries before the source elements", () => {
			const target: (number | undefined)[] = [0];

			pushAllFrom(target, [1, 2], -2);

			expect(target).toEqual([0, undefined, undefined, 1, 2]);
			expect(target).toHaveLength(5);
			expect(1 in target).toBe(true);
			expect(2 in target).toBe(true);
		});
	});

	describe("invalid start values", () => {
		it("should throw a RangeError for a NaN start and leave the target intact", () => {
			const target = [1, 2];

			expect(() => pushAllFrom(target, [3, 4], Number.NaN)).toThrow(
				RangeError,
			);
			expect(target).toEqual([1, 2]);
			expect(target).toHaveLength(2);
		});

		it("should throw a RangeError for a fractional start and leave the target intact", () => {
			const target = [0];

			expect(() => pushAllFrom(target, [1, 2], 0.5)).toThrow(RangeError);
			expect(target).toEqual([0]);
			expect(target).toHaveLength(1);
		});
	});

	describe("frozen target", () => {
		it("should throw a TypeError for a frozen target and leave it intact", () => {
			const target = [1, 2];

			Object.freeze(target);

			expect(() => pushAllFrom(target, [3, 4], 0)).toThrow(TypeError);
			expect(target).toEqual([1, 2]);
			expect(target).toHaveLength(2);
		});
	});

	describe("sparse source", () => {
		it("should materialize holes in the copied tail as undefined entries", () => {
			const target: (number | undefined)[] = [0];
			const source = new Array<number | undefined>(4);

			source[1] = 1;
			source[3] = 3;

			pushAllFrom(target, source, 1);

			expect(2 in source).toBe(false);
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
			const arr = [1, 2, 3];

			pushAllFrom(arr, arr, 1);

			expect(arr).toEqual([1, 2, 3, 2, 3]);
			expect(arr).toHaveLength(5);
		});
	});
});
