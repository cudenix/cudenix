import { beforeEach, describe, expect, it } from "bun:test";

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

			const result = pushAll(target, [1, 2]);

			expect(result).toBeUndefined();
		});
	});

	describe("in-place mutation", () => {
		let target: number[];
		let source: number[];

		beforeEach(() => {
			target = [1, 2];
			source = [3, 4, 5];
		});

		it("should mutate the target in place (same reference)", () => {
			const before = target;

			pushAll(target, source);

			expect(target).toBe(before);
			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		it("should not mutate the source array", () => {
			const snapshot = [...source];

			pushAll(target, source);

			expect(source).toEqual(snapshot);
		});
	});

	describe("element preservation", () => {
		it("should preserve duplicates from source", () => {
			const target = ["a"];

			pushAll(target, ["b", "b", "c"]);

			expect(target).toEqual(["a", "b", "b", "c"]);
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
			const x = { a: "v1" };
			const y = { a: "v2" };
			const z = { a: "v3" };
			const target: object[] = [x, y];

			pushAll(target, [z]);

			expect(target[0]).toBe(x);
			expect(target[1]).toBe(y);
			expect(target[2]).toBe(z);
		});

		it("should support mixing element types under a union generic", () => {
			const target: (number | string)[] = [1];

			pushAll<number | string>(target, ["v1", 3]);

			expect(target).toEqual([1, "v1", 3]);
		});

		it("should append null and undefined values without coercion", () => {
			const target: (number | null | undefined)[] = [0];

			pushAll(target, [null, undefined, 1]);

			expect(target).toEqual([0, null, undefined, 1]);
		});
	});

	describe("length and positioning", () => {
		it("should set the final length to base + source length", () => {
			const target = [1, 2, 3];
			const source = [4, 5, 6, 7];

			pushAll(target, source);

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

			expect(() => {
				const probe: number[] = [];

				probe.push(...source);
			}).toThrow(RangeError);

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
			const arr = [1, 2, 3];

			pushAll(arr, arr);

			expect(arr).toEqual([1, 2, 3, 1, 2, 3]);
			expect(arr).toHaveLength(6);
		});
	});

	describe("frozen and sealed targets", () => {
		it("should throw a TypeError and leave a frozen target unchanged", () => {
			const target = Object.freeze([1, 2]) as number[];

			expect(() => pushAll(target, [3, 4])).toThrow(TypeError);

			expect(target).toEqual([1, 2]);
			expect(target).toHaveLength(2);
		});

		it("should grow a sealed target's length before throwing a TypeError, leaving holes", () => {
			const target = Object.seal([1, 2]);

			expect(() => pushAll(target, [3, 4])).toThrow(TypeError);

			expect(target).toHaveLength(4);
			expect(Object.keys(target)).toEqual(["0", "1"]);
			expect(2 in target).toBe(false);
			expect(3 in target).toBe(false);
			expect(target[0]).toBe(1);
			expect(target[1]).toBe(2);
		});
	});
});
