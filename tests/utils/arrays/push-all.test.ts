import { describe, expect, test } from "bun:test";

import { pushAll } from "@/utils/arrays/push-all";

describe("pushAll", () => {
	describe("contract", () => {
		test("returns undefined (void contract)", () => {
			const target: number[] = [];

			const result = pushAll(target, [1, 2]);

			expect(result).toBeUndefined();
		});

		test("mutates the target in place (same reference)", () => {
			const target = [1, 2];
			const before = target;

			pushAll(target, [3]);

			expect(target).toBe(before);
			expect(target).toEqual([1, 2, 3]);
		});

		test("does not mutate the source array", () => {
			const target = [1, 2];
			const source = [3, 4, 5];
			const snapshot = [...source];

			pushAll(target, source);

			expect(source).toEqual(snapshot);
		});

		test("target and source remain distinct references after the call", () => {
			const source = [3, 4];
			const target = [1, 2];

			pushAll(target, source);

			expect(target).not.toBe(source);
		});
	});

	describe("ordering and content", () => {
		test("appends all elements of source to target in order", () => {
			const target = [1, 2];

			pushAll(target, [3, 4, 5]);

			expect(target).toEqual([1, 2, 3, 4, 5]);
		});

		test("preserves duplicates in source", () => {
			const target = ["a"];

			pushAll(target, ["b", "b", "c"]);

			expect(target).toEqual(["a", "b", "b", "c"]);
		});

		test("preserves element identity for objects", () => {
			const a = { id: 1 };
			const b = { id: 2 };
			const target: object[] = [];

			pushAll(target, [a, b]);

			expect(target[0]).toBe(a);
			expect(target[1]).toBe(b);
		});

		test("preserves identity of pre-existing target elements", () => {
			const x = { id: "x" };
			const y = { id: "y" };
			const z = { id: "z" };
			const target: object[] = [x, y];

			pushAll(target, [z]);

			expect(target[0]).toBe(x);
			expect(target[1]).toBe(y);
			expect(target[2]).toBe(z);
		});

		test("supports mixing element types under a union generic", () => {
			const target: (number | string)[] = [1];

			pushAll<number | string>(target, ["two", 3]);

			expect(target).toEqual([1, "two", 3]);
		});

		test("appends undefined and null values without coercion", () => {
			const target: (number | null | undefined)[] = [0];

			pushAll(target, [null, undefined, 1]);

			expect(target).toEqual([0, null, undefined, 1]);
		});

		test("final length equals base + source length", () => {
			const target = [1, 2, 3];
			const source = [10, 20, 30, 40];

			pushAll(target, source);

			expect(target).toHaveLength(7);
		});
	});

	describe("empty-array edge cases", () => {
		test("no-op when source is empty", () => {
			const target = [1, 2, 3];
			const snapshot = [...target];

			pushAll(target, []);

			expect(target).toEqual(snapshot);
		});

		test("works when target is empty (becomes a copy of source)", () => {
			const target: number[] = [];

			pushAll(target, [1, 2, 3]);

			expect(target).toEqual([1, 2, 3]);
		});

		test("no-op when both target and source are empty", () => {
			const target: number[] = [];

			pushAll(target, []);

			expect(target).toEqual([]);
			expect(target).toHaveLength(0);
		});
	});

	describe("aliasing", () => {
		test("snapshots base length before writing (no infinite growth when target === source)", () => {
			const arr = [1, 2, 3];

			pushAll(arr, arr);

			expect(arr).toEqual([1, 2, 3, 1, 2, 3]);
			expect(arr).toHaveLength(6);
		});
	});

	describe("sparse source", () => {
		test("materializes holes in source as undefined entries (no hole carry-over)", () => {
			const target: (number | undefined)[] = [0];
			const source: (number | undefined)[] = [1, undefined, 3];

			pushAll(target, source);

			expect(target).toHaveLength(4);
			expect(target[0]).toBe(0);
			expect(target[1]).toBe(1);
			expect(target[2]).toBeUndefined();
			expect(target[3]).toBe(3);
			expect(2 in target).toBe(true);
		});
	});

	describe("element positioning", () => {
		test("appends a single element correctly", () => {
			const target = [1, 2];

			pushAll(target, [99]);

			expect(target).toEqual([1, 2, 99]);
		});

		test("writes the first appended element exactly at target[baseLength]", () => {
			const target = [10, 20, 30];
			const baseLength = target.length;
			const source = [40, 50, 60];

			pushAll(target, source);

			expect(target[baseLength]).toBe(40);
			expect(target[baseLength + source.length - 1]).toBe(60);
		});
	});
});
