import { beforeEach, describe, expect, test } from "bun:test";

import { merge } from "@/utils/objects/merge";

describe("merge", () => {
	describe("key copying", () => {
		test("should copy all own enumerable string keys from source", () => {
			const target: Record<string, unknown> = {};

			merge(target, { a: 1, b: "two", c: true });

			expect(target).toEqual({ a: 1, b: "two", c: true });
		});

		test("should overwrite matching keys in target with values from source", () => {
			const target: Record<string, unknown> = { a: 1, b: 2 };

			merge(target, { b: 20, c: 30 });

			expect(target).toEqual({ a: 1, b: 20, c: 30 });
		});

		test("should preserve target keys that have no counterpart in source", () => {
			const target: Record<string, unknown> = { keep: 1, replace: 2 };

			merge(target, { replace: 99 });

			expect(target).toEqual({ keep: 1, replace: 99 });
		});
	});

	describe("mutation contract", () => {
		test("should return undefined (in-place mutation, no new container)", () => {
			const target = { a: 1 };

			const result = merge(target, { b: 2 });

			expect(result).toBeUndefined();
		});

		test("should mutate target in place keeping the same reference", () => {
			const target: Record<string, unknown> = { a: 1 };
			const before = target;

			merge(target, { b: 2 });

			expect(target).toBe(before);
			expect(target).toEqual({ a: 1, b: 2 });
		});

		test("should not mutate the source object", () => {
			const source = { a: 1, b: 2 };
			const snapshot = { ...source };

			merge({}, source);

			expect(source).toEqual(snapshot);
		});

		test("should leave values unchanged on self-merge (target === source)", () => {
			const obj: Record<string, unknown> = { a: 1, b: 2 };

			merge(obj, obj);

			expect(obj).toEqual({ a: 1, b: 2 });
		});
	});

	describe("value semantics", () => {
		test("should preserve value identity (reference values are not cloned)", () => {
			const inner = { nested: true };
			const target: Record<string, unknown> = {};

			merge(target, { inner });

			expect(target.inner).toBe(inner);
		});

		test("should treat undefined source values as explicit assignments", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { a: undefined });

			expect("a" in target).toBe(true);
			expect(target.a).toBeUndefined();
		});

		test("should treat null source values as explicit assignments", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { a: null });

			expect(target.a).toBeNull();
		});
	});

	describe("key ordering", () => {
		test("should preserve target's key order when overwriting existing keys", () => {
			const target: Record<string, unknown> = { a: 1, b: 2, c: 3 };

			merge(target, { b: 20 });

			expect(Object.keys(target)).toEqual(["a", "b", "c"]);
		});

		test("should append source-only keys after target's existing keys", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { b: 2, c: 3 });

			expect(Object.keys(target)).toEqual(["a", "b", "c"]);
		});
	});

	describe("empty inputs", () => {
		test("should leave target unchanged when source has no keys", () => {
			const target = { a: 1, b: 2 };

			merge(target, {});

			expect(target).toEqual({ a: 1, b: 2 });
		});

		test("should be a no-op when both target and source are empty", () => {
			const target: Record<string, unknown> = {};

			merge(target, {});

			expect(target).toEqual({});
			expect(Object.keys(target)).toHaveLength(0);
		});
	});

	describe("prototype chain", () => {
		let target: Record<string, unknown>;

		beforeEach(() => {
			target = {};
		});

		test("should walk the prototype chain of source via for..in", () => {
			const proto = { inherited: "fromProto" };
			const source = Object.create(proto);

			source.own = "fromOwn";

			merge(target, source);

			expect(target.own).toBe("fromOwn");
			expect(target.inherited).toBe("fromProto");
		});

		test("should walk multi-level prototype chains", () => {
			const grand = { fromGrand: "g" };
			const parent = Object.create(grand);

			parent.fromParent = "p";

			const source = Object.create(parent);

			source.fromOwn = "o";

			merge(target, source);

			expect(target).toEqual({
				fromGrand: "g",
				fromOwn: "o",
				fromParent: "p",
			});
		});

		test("should still copy own keys when source has a null prototype", () => {
			const source = Object.create(null);

			source.a = 1;
			source.b = 2;

			merge(target, source);

			expect(target).toEqual({ a: 1, b: 2 });
		});

		test("should copy enumerable instance fields of a class source but skip its prototype methods", () => {
			class Foo {
				instanceProp = "inst";

				method() {
					return "m";
				}
			}

			merge(target, new Foo() as unknown as Record<string, unknown>);

			expect(target.instanceProp).toBe("inst");
			expect("method" in target).toBe(false);
		});
	});

	describe("enumerability and key kinds", () => {
		let target: Record<PropertyKey, unknown>;

		beforeEach(() => {
			target = {};
		});

		test("should not copy symbol-keyed properties (for..in does not visit them)", () => {
			const sym = Symbol("ignored");
			const source: Record<PropertyKey, unknown> = { visible: 1 };

			source[sym] = "skipped";

			merge(target, source);

			expect(target.visible).toBe(1);
			expect(target[sym]).toBeUndefined();
			expect(Object.getOwnPropertySymbols(target)).toHaveLength(0);
		});

		test("should skip non-enumerable properties (for..in only visits enumerable)", () => {
			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "hidden", {
				enumerable: false,
				value: "nope",
			});

			source.visible = "yes";

			merge(target, source);

			expect(target.visible).toBe("yes");
			expect("hidden" in target).toBe(false);
		});
	});

	describe("accessors and descriptors", () => {
		test("should invoke source getters at copy time and store the resolved value", () => {
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
			expect(target.computed).toBe(42);
			expect(
				Object.getOwnPropertyDescriptor(target, "computed")?.get,
			).toBeUndefined();
		});

		test("should invoke target's own setter when the key is overwritten", () => {
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
			expect(target.x).toBe(7);
		});
	});

	describe("unusual sources", () => {
		test("should copy enumerable character indices from a string source", () => {
			const target: Record<PropertyKey, unknown> = {};

			merge(target, "hi" as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ 0: "h", 1: "i" });
		});

		test("should copy enumerable index keys from an array source and skip its non-enumerable length", () => {
			const target: Record<PropertyKey, unknown> = {};

			merge(target, [10, 20, 30] as unknown as Record<
				PropertyKey,
				unknown
			>);

			expect(target).toEqual({ 0: 10, 1: 20, 2: 30 });
			expect("length" in target).toBe(false);
		});

		test("should do nothing for primitive sources without enumerable keys", () => {
			const target = { a: 1 };

			merge(target, 123 as unknown as Record<PropertyKey, unknown>);
			merge(target, true as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});
	});

	describe("nullish sources", () => {
		let target: { a: number };

		beforeEach(() => {
			target = { a: 1 };
		});

		test("should do nothing when source is null", () => {
			merge(target, null as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});

		test("should do nothing when source is undefined", () => {
			merge(target, undefined as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});
	});

	describe("errors", () => {
		test("should throw TypeError when target is frozen and source adds a new key", () => {
			const target = Object.freeze({ a: 1 }) as Record<string, unknown>;

			expect(() => merge(target, { b: 2 })).toThrow(TypeError);
		});

		test("should throw when target is null and source has enumerable keys", () => {
			expect(() =>
				merge(null as unknown as Record<PropertyKey, unknown>, {
					a: 1,
				}),
			).toThrow(TypeError);
		});

		test("should throw when target is undefined and source has enumerable keys", () => {
			expect(() =>
				merge(undefined as unknown as Record<PropertyKey, unknown>, {
					a: 1,
				}),
			).toThrow(TypeError);
		});
	});

	describe("cyclic sources", () => {
		test("should copy a self-referential entry without infinite recursion", () => {
			interface Cyclic {
				name: string;
				self?: Cyclic;
			}

			const source = { name: "root" } as Cyclic;

			source.self = source;

			const target: Record<string, unknown> = {};

			merge(target, source as unknown as Record<string, unknown>);

			expect(target.name).toBe("root");
			expect(target.self).toBe(source);
		});
	});

	describe("prototype pollution surface", () => {
		test("should reassign target's prototype when source carries an own __proto__ key", () => {
			const target: Record<string, unknown> = {};
			const malicious = JSON.parse(
				'{"__proto__":{"polluted":"yes"}}',
			) as Record<string, unknown>;

			merge(target, malicious);

			expect(Object.getPrototypeOf(target)).toEqual({ polluted: "yes" });
			expect((target as Record<string, unknown>).polluted).toBe("yes");
			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		});
	});
});
