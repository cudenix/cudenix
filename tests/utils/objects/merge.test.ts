import { describe, expect, test } from "bun:test";

import { merge } from "@/utils/objects/merge";

describe("merge", () => {
	describe("contract", () => {
		test("returns undefined (in-place mutation, no new container)", () => {
			const target = { a: 1 };
			const result = merge(target, { b: 2 });

			expect(result).toBeUndefined();
		});

		test("mutates target in place (same reference)", () => {
			const target: Record<string, unknown> = { a: 1 };
			const before = target;

			merge(target, { b: 2 });

			expect(target).toBe(before);
			expect(target).toEqual({ a: 1, b: 2 });
		});

		test("does not mutate the source object", () => {
			const source = { a: 1, b: 2 };
			const snapshot = { ...source };

			merge({}, source);

			expect(source).toEqual(snapshot);
		});
	});

	describe("key copying", () => {
		test("copies all own enumerable string keys from source", () => {
			const target: Record<string, unknown> = {};

			merge(target, { a: 1, b: "two", c: true });

			expect(target).toEqual({ a: 1, b: "two", c: true });
		});

		test("overwrites matching keys with values from source", () => {
			const target: Record<string, unknown> = { a: 1, b: 2 };

			merge(target, { b: 20, c: 30 });

			expect(target).toEqual({ a: 1, b: 20, c: 30 });
		});

		test("preserves value identity (reference values are not cloned)", () => {
			const inner = { nested: true };
			const target: Record<string, unknown> = {};

			merge(target, { inner });

			expect(target["inner"]).toBe(inner);
		});

		test("preserves keys in target that have no counterpart in source", () => {
			const target: Record<string, unknown> = { keep: 1, replace: 2 };

			merge(target, { replace: 99 });

			expect(target).toEqual({ keep: 1, replace: 99 });
		});

		test("treats undefined source values as explicit assignments", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { a: undefined });

			expect("a" in target).toBe(true);
			expect(target["a"]).toBeUndefined();
		});

		test("treats null source values as explicit assignments", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { a: null });

			expect(target["a"]).toBeNull();
		});
	});

	describe("empty inputs", () => {
		test("leaves target unchanged when source has no keys", () => {
			const target = { a: 1, b: 2 };

			merge(target, {});

			expect(target).toEqual({ a: 1, b: 2 });
		});

		test("no-op when both target and source are empty", () => {
			const target: Record<string, unknown> = {};

			merge(target, {});

			expect(target).toEqual({});
			expect(Object.keys(target)).toHaveLength(0);
		});
	});

	describe("prototype-chain and enumerability", () => {
		test("walks the prototype chain of source (for..in)", () => {
			const proto = { inherited: "fromProto" };
			const source = Object.create(proto);
			source.own = "fromOwn";

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(target["own"]).toBe("fromOwn");
			expect(target["inherited"]).toBe("fromProto");
		});

		test("does not copy symbol-keyed properties", () => {
			const sym = Symbol("ignored");
			const source: Record<PropertyKey, unknown> = { visible: 1 };
			source[sym] = "skipped";

			const target: Record<PropertyKey, unknown> = {};

			merge(target, source);

			expect(target["visible"]).toBe(1);
			expect(target[sym]).toBeUndefined();
			expect(Object.getOwnPropertySymbols(target)).toHaveLength(0);
		});

		test("skips non-enumerable properties (for..in only visits enumerable)", () => {
			const source: Record<string, unknown> = {};
			Object.defineProperty(source, "hidden", {
				enumerable: false,
				value: "nope",
			});
			source["visible"] = "yes";

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(target["visible"]).toBe("yes");
			expect("hidden" in target).toBe(false);
		});

		test("source with a null prototype still has its own keys copied", () => {
			const source = Object.create(null);
			source.a = 1;
			source.b = 2;

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(target).toEqual({ a: 1, b: 2 });
		});

		test("multi-level prototype chains are walked", () => {
			const grand = { fromGrand: "g" };
			const parent = Object.create(grand);
			parent.fromParent = "p";
			const source = Object.create(parent);
			source.fromOwn = "o";

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(target).toEqual({
				fromGrand: "g",
				fromOwn: "o",
				fromParent: "p",
			});
		});
	});

	describe("unexpected inputs and errors", () => {
		test("does nothing when source is null", () => {
			const target = { a: 1 };

			merge(target, null as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});

		test("does nothing when source is undefined", () => {
			const target = { a: 1 };

			merge(target, undefined as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});

		test("throws when target is null and source has enumerable keys", () => {
			expect(() =>
				merge(null as unknown as Record<PropertyKey, unknown>, {
					a: 1,
				}),
			).toThrow(TypeError);
		});

		test("throws when target is undefined and source has enumerable keys", () => {
			expect(() =>
				merge(undefined as unknown as Record<PropertyKey, unknown>, {
					a: 1,
				}),
			).toThrow(TypeError);
		});

		test("copies enumerable character indices from a string source", () => {
			const target: Record<PropertyKey, unknown> = {};

			merge(target, "hi" as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ 0: "h", 1: "i" });
		});

		test("does nothing for primitive sources without enumerable keys", () => {
			const target = { a: 1 };

			merge(target, 123 as unknown as Record<PropertyKey, unknown>);
			merge(target, true as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});
	});
});
