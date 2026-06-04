import { beforeEach, describe, expect, test } from "bun:test";

import { pushAll } from "@/utils/arrays/push-all";

describe("pushAll", () => {
	describe("happy path", () => {
		test("should append all elements of source to target in order", () => {
			const target = [1, 2];

			pushAll(target, [3, 4, 5]);

			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		test("should append a single element to a non-empty target", () => {
			const target = [1, 2];

			pushAll(target, [3]);

			expect(target).toEqual([1, 2, 3]);
		});
	});

	describe("return value contract", () => {
		test("should return undefined (void contract)", () => {
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

		test("should mutate the target in place (same reference)", () => {
			const before = target;

			pushAll(target, source);

			expect(target).toBe(before);
			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		test("should not mutate the source array", () => {
			const snapshot = [...source];

			pushAll(target, source);

			expect(source).toEqual(snapshot);
		});
	});

	describe("element preservation", () => {
		test("should preserve duplicates from source", () => {
			const target = ["a"];

			pushAll(target, ["b", "b", "c"]);

			expect(target).toEqual(["a", "b", "b", "c"]);
		});

		test("should preserve element identity for objects appended from source", () => {
			const a = { a: 1 };
			const b = { a: 2 };
			const target: object[] = [];

			pushAll(target, [a, b]);

			expect(target[0]).toBe(a);
			expect(target[1]).toBe(b);
		});

		test("should preserve identity of pre-existing target elements", () => {
			const x = { a: "v1" };
			const y = { a: "v2" };
			const z = { a: "v3" };
			const target: object[] = [x, y];

			pushAll(target, [z]);

			expect(target[0]).toBe(x);
			expect(target[1]).toBe(y);
			expect(target[2]).toBe(z);
		});

		test("should support mixing element types under a union generic", () => {
			const target: (number | string)[] = [1];

			pushAll<number | string>(target, ["v1", 3]);

			expect(target).toEqual([1, "v1", 3]);
		});

		test("should append null and undefined values without coercion", () => {
			const target: (number | null | undefined)[] = [0];

			pushAll(target, [null, undefined, 1]);

			expect(target).toEqual([0, null, undefined, 1]);
		});
	});

	describe("length and positioning", () => {
		test("should set the final length to base + source length", () => {
			const target = [1, 2, 3];
			const source = [4, 5, 6, 7];

			pushAll(target, source);

			expect(target).toHaveLength(7);
		});

		test("should write the first appended element exactly at target[baseLength]", () => {
			const target = [1, 2, 3];
			const baseLength = target.length;
			const source = [4, 5, 6];

			pushAll(target, source);

			expect(target[baseLength]).toBe(4);
			expect(target[baseLength + source.length - 1]).toBe(6);
		});

		test("should append a large source in order without an argument-count limit", () => {
			const target = [0];
			const source = Array.from({ length: 100 }, (_, i) => i + 1);

			pushAll(target, source);

			expect(target).toHaveLength(101);
			expect(target[0]).toBe(0);
			expect(target[1]).toBe(1);
			expect(target[100]).toBe(100);
		});
	});

	describe("empty-array edge cases", () => {
		test("should be a no-op when source is empty", () => {
			const target = [1, 2, 3];
			const snapshot = [...target];

			pushAll(target, []);

			expect(target).toEqual(snapshot);
		});

		test("should become a copy of source when target is empty", () => {
			const target: number[] = [];

			pushAll(target, [1, 2, 3]);

			expect(target).toEqual([1, 2, 3]);
		});

		test("should be a no-op when both target and source are empty", () => {
			const target: number[] = [];

			pushAll(target, []);

			expect(target).toEqual([]);
			expect(target).toHaveLength(0);
		});
	});

	describe("sparse source", () => {
		test("should materialize holes in source as undefined entries (no hole carry-over)", () => {
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
		test("should snapshot base length before writing to avoid infinite growth", () => {
			const arr = [1, 2, 3];

			pushAll(arr, arr);

			expect(arr).toEqual([1, 2, 3, 1, 2, 3]);
			expect(arr).toHaveLength(6);
		});
	});
});
