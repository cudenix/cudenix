import { beforeAll, describe, expect, test } from "bun:test";

import { cloneAppend } from "@/utils/arrays/clone-append";

describe("cloneAppend", () => {
	describe("empty source", () => {
		describe("with empty source and string item 'a'", () => {
			let source: string[];
			let result: string[];

			beforeAll(() => {
				source = [];
				result = cloneAppend(source, "a");
			});

			test("should return a one-element array containing the appended item", () => {
				expect(result).toEqual(["a"]);
			});

			test("should not mutate the source array", () => {
				expect(source).toEqual([]);
				expect(source).toHaveLength(0);
			});

			test("should return a new array reference, not the source", () => {
				expect(result).not.toBe(source);
			});
		});

		test("should produce a dense array literal with no holes", () => {
			const result = cloneAppend([], 1);

			expect(Object.keys(result)).toEqual(["0"]);
		});

		test("should append an array item as a single element without spreading", () => {
			const result = cloneAppend<unknown>([], [1, 2]);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual([1, 2]);
		});

		test("should preserve object identity of the appended item", () => {
			const item = { a: 1 };

			const result = cloneAppend([], item);

			expect(result[0]).toBe(item);
		});
	});

	describe("single-element source", () => {
		describe("with source ['a'] and item 'b'", () => {
			let source: string[];
			let result: string[];

			beforeAll(() => {
				source = ["a"];
				result = cloneAppend(source, "b");
			});

			test("should return a two-element array preserving order", () => {
				expect(result).toEqual(["a", "b"]);
			});

			test("should not mutate the source array", () => {
				expect(source).toEqual(["a"]);
			});

			test("should return a fresh array reference", () => {
				expect(result).not.toBe(source);
			});
		});

		test("should preserve object identity of the single existing element", () => {
			const only = { a: 1 };
			const source = [only];

			const result = cloneAppend(source, { a: 2 });

			expect(result[0]).toBe(only);
		});

		test("should preserve object identity of the appended item", () => {
			const item = { a: 2 };

			const result = cloneAppend([{ a: 1 }], item);

			expect(result[1]).toBe(item);
		});

		test("should append an array item as a single element without spreading", () => {
			const result = cloneAppend<unknown>([1], [2, 3]);

			expect(result).toHaveLength(2);
			expect(result[1]).toEqual([2, 3]);
		});

		test("should append an array item as a single element without flattening", () => {
			const result = cloneAppend<unknown>(["a"], ["b", "c"]);

			expect(result).toEqual(["a", ["b", "c"]]);
		});
	});

	describe("multi-element source", () => {
		describe("with source ['a', 'b'] and item 'c'", () => {
			let source: string[];
			let result: string[];

			beforeAll(() => {
				source = ["a", "b"];
				result = cloneAppend(source, "c");
			});

			test("should append to the end and preserve all existing elements", () => {
				expect(result).toEqual(["a", "b", "c"]);
			});

			test("should return a fresh array reference", () => {
				expect(result).not.toBe(source);
			});
		});

		test("should not mutate the source array", () => {
			const source = ["a", "b", "c"];
			const snapshot = [...source];

			cloneAppend(source, "d");

			expect(source).toEqual(snapshot);
		});

		test("should work for longer arrays", () => {
			const source = [1, 2, 3, 4, 5];

			const result = cloneAppend(source, 6);

			expect(result).toEqual([1, 2, 3, 4, 5, 6]);
			expect(result).toHaveLength(source.length + 1);
		});

		test("should preserve order across many elements", () => {
			const source = Array.from({ length: 100 }, (_, i) => i);

			const result = cloneAppend(source, 100);

			expect(result).toHaveLength(101);
			expect(result[0]).toBe(0);
			expect(result[99]).toBe(99);
			expect(result[100]).toBe(100);
		});

		test("should preserve object identity for every existing element", () => {
			const a = { a: "v1" };
			const b = { a: "v2" };
			const c = { a: "v3" };

			const result = cloneAppend([a, b], c);

			expect(result[0]).toBe(a);
			expect(result[1]).toBe(b);
			expect(result[2]).toBe(c);
		});

		test("should preserve object identity of the appended item", () => {
			const item = { a: 3 };

			const result = cloneAppend([{ a: 1 }, { a: 2 }], item);

			expect(result[2]).toBe(item);
		});

		test("should append an array item as a single element without spreading", () => {
			const result = cloneAppend<unknown>([1, 2], [3, 4]);

			expect(result).toHaveLength(3);
			expect(result[2]).toEqual([3, 4]);
		});
	});

	describe("sparse source", () => {
		test("should materialize a hole at index 0 of a length-1 sparse source as undefined", () => {
			const sparse = new Array<number | undefined>(1);

			const result = cloneAppend<number | undefined>(sparse, 2);

			expect(result).toHaveLength(2);
			expect(result[0]).toBeUndefined();
			expect(result[1]).toBe(2);
			expect(0 in result).toBe(true);
		});

		test("should treat holes in a multi-element sparse source as undefined slots", () => {
			const sparse = new Array<number | undefined>(3);

			sparse[0] = 1;
			sparse[2] = 3;

			const result = cloneAppend<number | undefined>(sparse, 4);

			expect(result).toHaveLength(4);
			expect(result[0]).toBe(1);
			expect(result[1]).toBeUndefined();
			expect(result[2]).toBe(3);
			expect(result[3]).toBe(4);
			expect(1 in result).toBe(true);
		});
	});

	describe("appended item value handling", () => {
		test("should append null without skipping it", () => {
			const result = cloneAppend([1, 2], null as unknown as number);

			expect(result).toEqual([1, 2, null] as unknown as number[]);
		});

		test("should append undefined as a real element", () => {
			const result = cloneAppend(
				["a", "b"],
				undefined as unknown as string,
			);

			expect(result).toHaveLength(3);
			expect(result[2]).toBeUndefined();
		});

		test("should support heterogeneous element types via generics", () => {
			const result = cloneAppend<number | string>([1, 2], "three");

			expect(result).toEqual([1, 2, "three"]);
		});
	});

	describe("return value contract", () => {
		test("should return a plain Array instance for every branch", () => {
			expect(Array.isArray(cloneAppend([], 1))).toBe(true);
			expect(Array.isArray(cloneAppend([1], 2))).toBe(true);
			expect(Array.isArray(cloneAppend([1, 2], 3))).toBe(true);
		});
	});
});
