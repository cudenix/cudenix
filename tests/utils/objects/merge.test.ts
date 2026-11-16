import { describe, expect, it } from "bun:test";

import { merge } from "@/utils/objects/merge";

describe("merge", () => {
	it("should assign every key of source to target in place", () => {
		const inner = { a: true };
		const target: Record<string, unknown> = { a: 1, b: 2 };
		const source = { b: inner, c: undefined };
		const result = merge(target, source);

		expect(result).toBeUndefined();
		expect(target).toEqual({ a: 1, b: inner, c: undefined });
		expect(target.b).toBe(inner);
		expect(Object.hasOwn(target, "c")).toBe(true);
		expect(source).toEqual({ b: inner, c: undefined });
	});

	it("should copy inherited enumerable keys as own keys", () => {
		const target: Record<string, unknown> = {};
		const source: Record<string, unknown> = { b: "v2" };

		Object.setPrototypeOf(source, { a: "v1" });

		merge(target, source);

		expect(Object.entries(target)).toEqual([
			["b", "v2"],
			["a", "v1"],
		]);
	});

	it("should skip symbol and non-enumerable keys", () => {
		const symbol = Symbol("a");
		const target: Record<PropertyKey, unknown> = {};
		const source: Record<PropertyKey, unknown> = { a: 1, [symbol]: "v1" };

		Object.defineProperty(source, "b", { enumerable: false, value: "v2" });

		merge(target, source);

		expect(Reflect.ownKeys(target)).toEqual(["a"]);
	});

	it("should replace the prototype of target when source owns a `__proto__` key", () => {
		const target: Record<string, unknown> = {};

		merge(target, JSON.parse('{"__proto__":{"a":"v1"}}'));

		expect(Object.keys(target)).toHaveLength(0);
		expect(Object.getPrototypeOf(target)).toEqual({ a: "v1" });
		expect(({} as Record<string, unknown>).a).toBeUndefined();
	});

	it("should require the keys shared with target to keep the target's type", () => {
		const target: { a: number; b?: string } = { a: 1 };

		// @ts-expect-error - "a" is a number in the target
		merge(target, { a: "v1" });
		merge(target, { a: 2, b: "v1" });

		expect(target).toEqual({ a: 2, b: "v1" });
	});
});
