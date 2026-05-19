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

		test("self-merge (target === source) leaves values unchanged", () => {
			const obj: Record<string, unknown> = { a: 1, b: 2 };

			merge(obj, obj);

			expect(obj).toEqual({ a: 1, b: 2 });
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

		test("preserves target's key order when overwriting existing keys", () => {
			const target: Record<string, unknown> = { a: 1, b: 2, c: 3 };

			merge(target, { b: 20 });

			expect(Object.keys(target)).toEqual(["a", "b", "c"]);
		});

		test("appends source-only keys after target's existing keys", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { b: 2, c: 3 });

			expect(Object.keys(target)).toEqual(["a", "b", "c"]);
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

		test("copies enumerable instance fields of a class source but skips its prototype methods", () => {
			class Foo {
				instanceProp = "inst";
				method() {
					return "m";
				}
			}

			const target: Record<string, unknown> = {};

			merge(target, new Foo() as unknown as Record<string, unknown>);

			expect(target["instanceProp"]).toBe("inst");
			expect("method" in target).toBe(false);
		});
	});

	describe("accessors and descriptors", () => {
		test("invokes source getters at copy time and stores the resolved value", () => {
			let reads = 0;
			const source: Record<string, unknown> = {};
			Object.defineProperty(source, "computed", {
				enumerable: true,
				get() {
					reads += 1;
					return 42;
				},
			});

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(reads).toBe(1);
			expect(target["computed"]).toBe(42);
			expect(
				Object.getOwnPropertyDescriptor(target, "computed")?.get,
			).toBeUndefined();
		});

		test("invokes target's own setter when the key is overwritten", () => {
			let captured: unknown;
			const target: Record<string, unknown> = {};
			Object.defineProperty(target, "x", {
				configurable: true,
				enumerable: true,
				get() {
					return captured;
				},
				set(value: unknown) {
					captured = value;
				},
			});

			merge(target, { x: 7 });

			expect(captured).toBe(7);
			expect(target["x"]).toBe(7);
		});

		test("throws TypeError when target is frozen and source adds a new key", () => {
			const target = Object.freeze({ a: 1 }) as Record<string, unknown>;

			expect(() => merge(target, { b: 2 })).toThrow(TypeError);
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

		test("copies enumerable index keys from an array source and skips its non-enumerable length", () => {
			const target: Record<PropertyKey, unknown> = {};

			merge(
				target,
				[10, 20, 30] as unknown as Record<PropertyKey, unknown>,
			);

			expect(target).toEqual({ 0: 10, 1: 20, 2: 30 });
			expect("length" in target).toBe(false);
		});

		test("does nothing for primitive sources without enumerable keys", () => {
			const target = { a: 1 };

			merge(target, 123 as unknown as Record<PropertyKey, unknown>);
			merge(target, true as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});
	});

	describe("prototype pollution surface", () => {
		test("a source carrying an own __proto__ key reassigns target's prototype", () => {
			const target: Record<string, unknown> = {};
			const malicious = JSON.parse(
				'{"__proto__":{"polluted":"yes"}}',
			) as Record<string, unknown>;

			merge(target, malicious);

			expect(Object.getPrototypeOf(target)).toEqual({ polluted: "yes" });
			expect((target as Record<string, unknown>)["polluted"]).toBe("yes");
			expect(
				({} as Record<string, unknown>)["polluted"],
			).toBeUndefined();
		});
	});
});
