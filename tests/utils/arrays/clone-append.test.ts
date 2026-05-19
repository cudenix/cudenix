import { describe, expect, test } from "bun:test";

import { cloneAppend } from "@/utils/arrays/clone-append";

describe("cloneAppend", () => {
	describe("length === 0 branch", () => {
		test("returns a one-element array when the source is empty", () => {
			const result = cloneAppend([], "a");

			expect(result).toEqual(["a"]);
		});

		test("does not mutate the empty source array", () => {
			const source: string[] = [];

			cloneAppend(source, "a");

			expect(source).toEqual([]);
			expect(source).toHaveLength(0);
		});

		test("returns a new array reference, not the source", () => {
			const source: string[] = [];

			const result = cloneAppend(source, "a");

			expect(result).not.toBe(source);
		});

		test("produces a literal array (no holes)", () => {
			const result = cloneAppend([], 42);

			expect(Object.keys(result)).toEqual(["0"]);
		});
	});

	describe("length === 1 branch", () => {
		test("returns a two-element array preserving order", () => {
			const result = cloneAppend(["a"], "b");

			expect(result).toEqual(["a", "b"]);
		});

		test("does not mutate the single-element source", () => {
			const source = ["a"];

			cloneAppend(source, "b");

			expect(source).toEqual(["a"]);
		});

		test("returns a fresh array reference", () => {
			const source = ["a"];

			const result = cloneAppend(source, "b");

			expect(result).not.toBe(source);
		});

		test("preserves object identity for the single existing element", () => {
			const only = { id: 1 };
			const source = [only];

			const result = cloneAppend(source, { id: 2 });

			expect(result[0]).toBe(only);
		});
	});

	describe("length >= 2 branch", () => {
		test("appends to the end and preserves all elements", () => {
			const result = cloneAppend(["a", "b"], "c");

			expect(result).toEqual(["a", "b", "c"]);
		});

		test("works for longer arrays", () => {
			const source = [1, 2, 3, 4, 5];

			const result = cloneAppend(source, 6);

			expect(result).toEqual([1, 2, 3, 4, 5, 6]);
			expect(result).toHaveLength(source.length + 1);
		});

		test("does not mutate the source", () => {
			const source = ["a", "b", "c"];
			const snapshot = [...source];

			cloneAppend(source, "d");

			expect(source).toEqual(snapshot);
		});

		test("returns a fresh array reference", () => {
			const source = ["a", "b"];

			const result = cloneAppend(source, "c");

			expect(result).not.toBe(source);
		});

		test("preserves order across many elements", () => {
			const source = Array.from({ length: 100 }, (_, i) => i);

			const result = cloneAppend(source, 100);

			expect(result).toHaveLength(101);
			expect(result[0]).toBe(0);
			expect(result[99]).toBe(99);
			expect(result[100]).toBe(100);
		});

		test("preserves object identity for every existing element", () => {
			const a = { id: "a" };
			const b = { id: "b" };
			const c = { id: "c" };

			const result = cloneAppend([a, b], c);

			expect(result[0]).toBe(a);
			expect(result[1]).toBe(b);
			expect(result[2]).toBe(c);
		});
	});

	describe("type behavior", () => {
		test("appends an array item as a single element (no spreading)", () => {
			const result = cloneAppend<unknown>([1, 2], [3, 4]);

			expect(result).toHaveLength(3);
			expect(result[2]).toEqual([3, 4]);
		});

		test("appends null without skipping it", () => {
			const result = cloneAppend([1, 2], null as unknown as number);

			expect(result).toEqual([1, 2, null] as unknown as number[]);
		});

		test("appends undefined as a real element", () => {
			const result = cloneAppend(
				["a", "b"],
				undefined as unknown as string,
			);

			expect(result).toHaveLength(3);
			expect(result[2]).toBeUndefined();
		});

		test("supports heterogeneous element types via generics", () => {
			const result = cloneAppend<number | string>([1, 2], "three");

			expect(result).toEqual([1, 2, "three"]);
		});

		test("preserves object identity for appended item", () => {
			const item = { id: 1 };

			const result = cloneAppend([], item);

			expect(result[0]).toBe(item);
		});

		test("treats holes in length >= 2 sources as undefined slots", () => {
			const sparse = new Array<number | undefined>(3);
			sparse[0] = 1;
			sparse[2] = 3;

			const result = cloneAppend<number | undefined>(sparse, 4);

			expect(result).toHaveLength(4);
			expect(result[0]).toBe(1);
			expect(result[1]).toBeUndefined();
			expect(result[2]).toBe(3);
			expect(result[3]).toBe(4);
		});

		test("the returned array is a plain Array instance", () => {
			expect(Array.isArray(cloneAppend([], 1))).toBe(true);
			expect(Array.isArray(cloneAppend([1], 2))).toBe(true);
			expect(Array.isArray(cloneAppend([1, 2], 3))).toBe(true);
		});
	});
});
