import { beforeEach, describe, expect, it } from "bun:test";

import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";

describe("merge", () => {
	describe("key copying", () => {
		it("should copy all own enumerable string keys from source", () => {
			const target: Record<string, unknown> = {};

			merge(target, { a: 1, b: "v1", c: true });

			expect(target).toEqual({ a: 1, b: "v1", c: true });
		});

		it("should overwrite matching keys in target with values from source", () => {
			const target: Record<string, unknown> = { a: 1, b: 2 };

			merge(target, { b: 3, c: 4 });

			expect(target).toEqual({ a: 1, b: 3, c: 4 });
		});

		it("should preserve target keys that have no counterpart in source", () => {
			const target: Record<string, unknown> = { a: 1, b: 2 };

			merge(target, { b: 3 });

			expect(target).toEqual({ a: 1, b: 3 });
		});
	});

	describe("mutation contract", () => {
		it("should return undefined (in-place mutation, no new container)", () => {
			expect(merge({ a: 1 }, { b: 2 })).toBeUndefined();
		});

		it("should mutate the provided target", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { b: 2 });

			expect(target).toEqual({ a: 1, b: 2 });
		});

		it("should not mutate the source object", () => {
			const source = { a: 1, b: 2 };
			const snapshot = { ...source };

			merge({}, source);

			expect(source).toEqual(snapshot);
		});

		it("should leave values unchanged on self-merge (target === source)", () => {
			const target: Record<string, unknown> = { a: 1, b: 2 };

			merge(target, target);

			expect(target).toEqual({ a: 1, b: 2 });
		});
	});

	describe("value semantics", () => {
		it("should preserve value identity (reference values are not cloned)", () => {
			const inner = { a: true };
			const target: Record<string, unknown> = {};

			merge(target, { a: inner });

			expect(target.a).toBe(inner);
		});

		it("should treat undefined source values as explicit assignments", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { a: undefined });

			expect("a" in target).toBe(true);
			expect(target.a).toBeUndefined();
		});

		it("should treat null source values as explicit assignments", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { a: null });

			expect(target.a).toBeNull();
		});
	});

	describe("key ordering", () => {
		it("should preserve target's key order when overwriting existing keys", () => {
			const target: Record<string, unknown> = { a: 1, b: 2, c: 3 };

			merge(target, { b: 4 });

			expect(Object.keys(target)).toEqual(["a", "b", "c"]);
		});

		it("should append source-only keys after target's existing keys", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { b: 2, c: 3 });

			expect(Object.keys(target)).toEqual(["a", "b", "c"]);
		});

		it("should surface integer-like keys first in the result (JS own-key ordering of the target, not merge behavior)", () => {
			const target: Record<string, unknown> = { a: 1 };

			merge(target, { "1": 2 });

			expect(Object.keys(target)).toEqual(["1", "a"]);
		});
	});

	describe("empty inputs", () => {
		it("should leave target unchanged when source has no keys", () => {
			const target = { a: 1, b: 2 };

			merge(target, {});

			expect(target).toEqual({ a: 1, b: 2 });
		});

		it("should be a no-op when both target and source are empty", () => {
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

		it("should walk the prototype chain of source via for..in", () => {
			const source = Object.create({ a: "v1" });

			source.b = "v2";

			merge(target, source);

			expect(target.b).toBe("v2");
			expect(target.a).toBe("v1");
		});

		it("should walk multi-level prototype chains", () => {
			const parent = Object.create({ a: "v1" });

			parent.b = "v2";

			const source = Object.create(parent);

			source.c = "v3";

			merge(target, source);

			expect(target).toEqual({ a: "v1", b: "v2", c: "v3" });
		});

		it("should visit a shadowed inherited key once with the own value winning", () => {
			let writes = 0;
			let captured: unknown;

			Object.defineProperty(target, "a", {
				configurable: true,
				enumerable: true,
				get() {
					return captured;
				},
				set(value: unknown) {
					writes++;
					captured = value;
				},
			});

			const source = Object.create({ a: "v1" });

			source.a = "v2";

			merge(target, source);

			expect(writes).toBe(1);
			expect(target.a).toBe("v2");
		});

		it("should still copy own keys when source has a null prototype", () => {
			const source = Object.create(null);

			source.a = 1;
			source.b = 2;

			merge(target, source);

			expect(target).toEqual({ a: 1, b: 2 });
		});

		it("should copy enumerable instance fields of a class source but skip its prototype methods", () => {
			class A {
				a = "v1";

				b(): string {
					return "v2";
				}
			}

			merge(target, new A() as unknown as Record<string, unknown>);

			expect(target.a).toBe("v1");
			expect("b" in target).toBe(false);
		});
	});

	describe("enumerability and key kinds", () => {
		let target: Record<PropertyKey, unknown>;

		beforeEach(() => {
			target = {};
		});

		it("should not copy symbol-keyed properties (for..in does not visit them)", () => {
			const sym = Symbol("a");
			const source: Record<PropertyKey, unknown> = { a: 1 };

			source[sym] = "v1";

			merge(target, source);

			expect(target.a).toBe(1);
			expect(target[sym]).toBeUndefined();
			expect(Object.getOwnPropertySymbols(target)).toHaveLength(0);
		});

		it("should skip non-enumerable properties (for..in only visits enumerable)", () => {
			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "a", {
				enumerable: false,
				value: "v1",
			});

			source.b = "v2";

			merge(target, source);

			expect(target.b).toBe("v2");
			expect("a" in target).toBe(false);
		});
	});

	describe("accessors and descriptors", () => {
		it("should invoke source getters at copy time and store the resolved value", () => {
			let reads = 0;

			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "a", {
				enumerable: true,
				get() {
					reads++;

					return 1;
				},
			});

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(reads).toBe(1);
			expect(target.a).toBe(1);
			expect(
				Object.getOwnPropertyDescriptor(target, "a")?.get,
			).toBeUndefined();
		});

		it("should propagate a throwing source getter and keep keys copied before the throw", () => {
			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "a", {
				enumerable: true,
				get() {
					return 1;
				},
			});

			Object.defineProperty(source, "b", {
				enumerable: true,
				get() {
					throw new Error("v1");
				},
			});

			Object.defineProperty(source, "c", {
				enumerable: true,
				get() {
					return 3;
				},
			});

			const target: Record<string, unknown> = {};

			expect(() => merge(target, source)).toThrow("v1");
			expect(target).toEqual({ a: 1 });
			expect("b" in target).toBe(false);
			expect("c" in target).toBe(false);
		});

		it("should invoke target's own setter when the key is overwritten", () => {
			let captured: unknown;

			const target: Record<string, unknown> = {};

			Object.defineProperty(target, "a", {
				configurable: true,
				enumerable: true,
				get() {
					return captured;
				},
				set(value: unknown) {
					captured = value;
				},
			});

			merge(target, { a: 1 });

			expect(captured).toBe(1);
			expect(target.a).toBe(1);
		});
	});

	describe("unusual sources", () => {
		it("should copy enumerable character indices from a string source", () => {
			const target: Record<PropertyKey, unknown> = {};

			merge(target, "ab" as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ 0: "a", 1: "b" });
		});

		it("should copy enumerable index keys from an array source and skip its non-enumerable length", () => {
			const target: Record<PropertyKey, unknown> = {};

			merge(target, [1, 2, 3] as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ 0: 1, 1: 2, 2: 3 });
			expect("length" in target).toBe(false);
		});

		it("should skip holes in a sparse array source (for..in does not visit them)", () => {
			const target: Record<PropertyKey, unknown> = {};
			const source = [1, 2, 3];

			delete source[1];

			merge(target, source as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ 0: 1, 2: 3 });
			expect("1" in target).toBe(false);
		});

		it("should do nothing for primitive sources without enumerable keys", () => {
			const target = { a: 1 };

			merge(target, 2 as unknown as Record<PropertyKey, unknown>);
			merge(target, true as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});
	});

	describe("nullish sources", () => {
		let target: { a: number };

		beforeEach(() => {
			target = { a: 1 };
		});

		it("should do nothing when source is null", () => {
			merge(target, null as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});

		it("should do nothing when source is undefined", () => {
			merge(target, undefined as unknown as Record<PropertyKey, unknown>);

			expect(target).toEqual({ a: 1 });
		});
	});

	describe("errors", () => {
		it("should throw TypeError when target is frozen and source adds a new key", () => {
			const target = Object.freeze({ a: 1 }) as Record<string, unknown>;

			expect(() => merge(target, { b: 2 })).toThrow(TypeError);
		});

		it("should throw when target is null and source has enumerable keys", () => {
			expect(() =>
				merge(null as unknown as Record<PropertyKey, unknown>, {
					a: 1,
				}),
			).toThrow(TypeError);
		});

		it("should throw when target is undefined and source has enumerable keys", () => {
			expect(() =>
				merge(undefined as unknown as Record<PropertyKey, unknown>, {
					a: 1,
				}),
			).toThrow(TypeError);
		});

		it("should throw TypeError when target is frozen and source overwrites an existing key with an identical value", () => {
			const target = Object.freeze({ a: 1 }) as Record<string, unknown>;

			expect(() => merge(target, { a: 1 })).toThrow(TypeError);
		});
	});

	describe("unusable targets left untouched by a keyless source", () => {
		it("should not throw when target is null and source has no enumerable keys", () => {
			expect(() =>
				merge(null as unknown as Record<PropertyKey, unknown>, {}),
			).not.toThrow();
		});

		it("should not throw when target is undefined and source has no enumerable keys", () => {
			expect(() =>
				merge(undefined as unknown as Record<PropertyKey, unknown>, {}),
			).not.toThrow();
		});

		it("should not throw when target is frozen and source has no enumerable keys", () => {
			const target = Object.freeze({ a: 1 }) as Record<string, unknown>;

			expect(() => merge(target, {})).not.toThrow();
			expect(target).toEqual({ a: 1 });
		});

		it("should not throw when target is null and source only carries non-enumerable or symbol keys", () => {
			const source: Record<PropertyKey, unknown> = {};

			Object.defineProperty(source, "a", { enumerable: false, value: 1 });

			source[Symbol("b")] = 2;

			expect(() =>
				merge(null as unknown as Record<PropertyKey, unknown>, source),
			).not.toThrow();
		});
	});

	describe("visit order", () => {
		it("should write integer-like keys first, then own keys, then inherited keys", () => {
			const writes: string[] = [];
			const target = new Proxy<Record<string, unknown>>(
				{},
				{
					set(object, key, value) {
						writes.push(String(key));

						object[String(key)] = value;

						return true;
					},
				},
			);
			const source = Object.create({ "2": "v1", c: "v2" });

			source.b = "v3";
			source["1"] = "v4";
			source.a = "v5";

			merge(target, source);

			expect(writes).toEqual(["1", "b", "a", "2", "c"]);
		});

		it("should skip an inherited enumerable key shadowed by an own non-enumerable key", () => {
			const target: Record<string, unknown> = {};
			const source = Object.create({ a: "v1", b: "v2" });

			Object.defineProperty(source, "a", {
				enumerable: false,
				value: "v3",
			});

			merge(target, source);

			expect(target).toEqual({ b: "v2" });
		});
	});

	describe("source mutated during the copy", () => {
		it("should skip a key deleted by an earlier source getter", () => {
			const target: Record<string, unknown> = {};
			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "a", {
				configurable: true,
				enumerable: true,
				get() {
					delete source.b;

					return 1;
				},
			});

			source.b = 2;
			source.c = 3;

			merge(target, source);

			expect(target).toEqual({ a: 1, c: 3 });
			expect("b" in target).toBe(false);
		});

		it("should skip a key deleted by a target setter", () => {
			const target: Record<string, unknown> = {};
			const source: Record<string, unknown> = { a: 1, b: 2 };

			Object.defineProperty(target, "a", {
				enumerable: true,
				set() {
					delete source.b;
				},
			});

			merge(target, source);

			expect("b" in target).toBe(false);
		});

		it("should not visit a key added by an earlier source getter", () => {
			const target: Record<string, unknown> = {};
			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "a", {
				enumerable: true,
				get() {
					source.c = 3;

					return 1;
				},
			});

			source.b = 2;

			merge(target, source);

			expect(target).toEqual({ a: 1, b: 2 });
		});

		it("should copy the latest value of a key reassigned by an earlier source getter", () => {
			const target: Record<string, unknown> = {};
			const source: Record<string, unknown> = {};

			Object.defineProperty(source, "a", {
				enumerable: true,
				get() {
					source.b = 3;

					return 1;
				},
			});

			source.b = 2;

			merge(target, source);

			expect(target).toEqual({ a: 1, b: 3 });
		});
	});

	describe("assignment semantics on target", () => {
		it("should invoke a setter inherited by target without creating an own key", () => {
			let captured: unknown;

			const proto = {};

			Object.defineProperty(proto, "a", {
				enumerable: true,
				get() {
					return captured;
				},
				set(value: unknown) {
					captured = value;
				},
			});

			const target = Object.create(proto) as Record<string, unknown>;

			merge(target, { a: 1 });

			expect(captured).toBe(1);
			expect(Object.hasOwn(target, "a")).toBe(false);
		});

		it("should throw TypeError on a non-writable target key and keep its value", () => {
			const target: Record<string, unknown> = {};

			Object.defineProperty(target, "a", {
				enumerable: true,
				value: 1,
				writable: false,
			});

			expect(() => merge(target, { a: 2 })).toThrow(TypeError);
			expect(target.a).toBe(1);
		});

		it("should propagate a throwing target setter and keep keys copied before the throw", () => {
			const target: Record<string, unknown> = {};

			Object.defineProperty(target, "b", {
				enumerable: true,
				set() {
					throw new Error("v1");
				},
			});

			expect(() => merge(target, { a: 1, b: 2, c: 3 })).toThrow("v1");
			expect(target.a).toBe(1);
			expect("c" in target).toBe(false);
		});

		it("should write index keys through an array target and grow its length", () => {
			const target = [1, 2] as unknown as Record<PropertyKey, unknown>;

			merge(target, { "0": "v1", "2": "v2" });

			expect(target as unknown).toEqual(["v1", 2, "v2"]);
		});
	});

	describe("exotic sources", () => {
		it("should read each key of a Proxy source once through its get trap", () => {
			const reads: string[] = [];
			const source = new Proxy<Record<string, unknown>>(
				{ a: 1, b: 2 },
				{
					get(object, key) {
						reads.push(String(key));

						return object[String(key)];
					},
				},
			);
			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(target).toEqual({ a: 1, b: 2 });
			expect(reads).toEqual(["a", "b"]);
		});

		it("should copy enumerable own keys of a function source", () => {
			const target: Record<string, unknown> = {};

			merge(
				target,
				Object.assign(() => {}, { a: 1 }) as unknown as Record<
					string,
					unknown
				>,
			);

			expect(target).toEqual({ a: 1 });
		});

		it("should copy nothing from a Map source", () => {
			const target: Record<string, unknown> = {};

			merge(
				target,
				new Map([["a", 1]]) as unknown as Record<string, unknown>,
			);

			expect(target).toEqual({});
		});

		it("should copy every key of a large source", () => {
			const source: Record<string, unknown> = {};

			for (let i = 0; i < 200; i++) {
				source[`k${i}`] = i;
			}

			const target: Record<string, unknown> = {};

			merge(target, source);

			expect(target).toEqual(source);
			expect(Object.keys(target)).toEqual(Object.keys(source));
		});
	});

	describe("cyclic sources", () => {
		it("should copy a self-referential entry without infinite recursion", () => {
			interface A {
				a: string;
				b?: A;
			}

			const source = { a: "v1" } as A;

			source.b = source;

			const target: Record<string, unknown> = {};

			merge(target, source as unknown as Record<string, unknown>);

			expect(target.a).toBe("v1");
			expect(target.b).toBe(source);
		});
	});

	describe("prototype pollution surface", () => {
		it("should reassign target's prototype when source carries an own __proto__ key", () => {
			const target: Record<string, unknown> = {};

			merge(target, JSON.parse('{"__proto__":{"a":"v1"}}'));

			expect(Object.getPrototypeOf(target)).toEqual({ a: "v1" });
			expect(target.a).toBe("v1");
			expect(({} as Record<string, unknown>).a).toBeUndefined();
		});

		it("should store __proto__ as a regular own key on an Empty target", () => {
			const target = new Empty();

			merge(target, JSON.parse('{"__proto__":{"a":"v1"}}'));

			expect(Object.hasOwn(target, "__proto__")).toBe(true);
			expect(target.__proto__).toEqual({ a: "v1" });
			expect(Object.getPrototypeOf(target)).toBe(Empty.prototype);
			expect(target.a).toBeUndefined();
		});

		it("should store constructor as a benign own key without touching Object.prototype", () => {
			const target: Record<string, unknown> = {};

			merge(target, JSON.parse('{"constructor":{"a":1}}'));

			expect(Object.hasOwn(target, "constructor")).toBe(true);
			expect(
				Object.getOwnPropertyDescriptor(target, "constructor")?.value,
			).toEqual({ a: 1 });
			expect(Object.prototype.constructor).toBe(Object);
			expect(({} as Record<string, unknown>).a).toBeUndefined();
		});
	});
});
