import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { Empty } from "@/utils/objects/empty";

describe("Empty", () => {
	describe("construction", () => {
		it("should produce a non-null object", () => {
			const instance = new Empty();

			expect(typeof instance).toBe("object");
			expect(instance).not.toBeNull();
		});

		it("should have no own keys on a fresh instance", () => {
			const instance = new Empty();

			expect(Object.keys(instance)).toHaveLength(0);
			expect(Reflect.ownKeys(instance)).toHaveLength(0);
		});

		it("should return a fresh instance on each call", () => {
			expect(new Empty()).not.toBe(new Empty());
		});

		it("should mark instances as instanceof Empty", () => {
			expect(new Empty()).toBeInstanceOf(Empty);
		});
	});

	describe("serialization of a fresh instance", () => {
		let instance: Record<PropertyKey, unknown>;

		beforeAll(() => {
			instance = new Empty();
		});

		it("should serialize to '{}' via JSON.stringify", () => {
			expect(JSON.stringify(instance)).toBe("{}");
		});

		it("should spread to an empty object literal", () => {
			expect({ ...instance }).toEqual({});
		});

		it("should return an empty array from Object.entries", () => {
			expect(Object.entries(instance)).toEqual([]);
		});

		it("should return an empty array from Object.values", () => {
			expect(Object.values(instance)).toEqual([]);
		});
	});

	describe("serialization of a populated instance", () => {
		const dangerous = "constructor";

		let nested: Record<PropertyKey, unknown>;
		let instance: Record<PropertyKey, unknown>;

		beforeEach(() => {
			nested = new Empty();
			nested.a = 2;

			instance = new Empty();
			instance.a = 1;
			instance.b = nested;
			instance[dangerous as string] = "v1";
		});

		it("should serialize own keys in insertion order via JSON.stringify, including a nested instance and a 'constructor' key", () => {
			expect(JSON.stringify(instance)).toBe(
				'{"a":1,"b":{"a":2},"constructor":"v1"}',
			);
		});

		it("should spread to a plain object carrying every own key by reference", () => {
			const spread = { ...instance };

			expect(Object.keys(spread)).toEqual(["a", "b", "constructor"]);
			expect(spread.a).toBe(1);
			expect(spread.b).toBe(nested);
			expect(spread[dangerous]).toBe("v1");
		});

		it("should return every own entry in insertion order from Object.entries", () => {
			const entries = Object.entries(instance);

			expect(entries.map(([key]) => key)).toEqual([
				"a",
				"b",
				"constructor",
			]);
			expect(entries[0]?.[1]).toBe(1);
			expect(entries[1]?.[1]).toBe(nested);
			expect(entries[2]?.[1]).toBe("v1");
		});

		it("should return every own value in insertion order from Object.values", () => {
			const values = Object.values(instance);

			expect(values).toHaveLength(3);
			expect(values[0]).toBe(1);
			expect(values[1]).toBe(nested);
			expect(values[2]).toBe("v1");
		});

		it("should not inherit a toJSON hook that could rewrite the serialized shape", () => {
			expect("toJSON" in instance).toBe(false);
			expect(JSON.parse(JSON.stringify(instance))).toEqual({
				a: 1,
				b: { a: 2 },
				constructor: "v1",
			});
		});
	});

	describe("prototype chain", () => {
		let instance: Record<PropertyKey, unknown>;

		beforeAll(() => {
			instance = new Empty();
		});

		it("should inherit from Empty.prototype", () => {
			expect(Object.getPrototypeOf(instance)).toBe(Empty.prototype);
		});

		it("should have a null prototype on Empty.prototype itself", () => {
			expect(Object.getPrototypeOf(Empty.prototype)).toBeNull();
		});

		it("should not have Object.prototype in the instance prototype chain", () => {
			expect(Object.prototype.isPrototypeOf(instance)).toBe(false);
		});

		it("should not expose Object.prototype keys via inheritance", () => {
			expect("toString" in instance).toBe(false);
			expect("hasOwnProperty" in instance).toBe(false);
			expect("constructor" in instance).toBe(false);
			expect(instance.toString).toBeUndefined();
		});

		it("should not expose additional Object.prototype keys", () => {
			expect("valueOf" in instance).toBe(false);
			expect("propertyIsEnumerable" in instance).toBe(false);
			expect("isPrototypeOf" in instance).toBe(false);
			expect("toLocaleString" in instance).toBe(false);
			expect(instance.valueOf).toBeUndefined();
			expect(instance.propertyIsEnumerable).toBeUndefined();
		});

		it("should leave __proto__ accessor undefined on instances", () => {
			expect(instance.__proto__).toBeUndefined();
		});

		it("should yield no keys when iterating with for...in on a fresh instance", () => {
			const keys: string[] = [];

			for (const key in instance) {
				keys.push(key);
			}

			expect(keys).toHaveLength(0);
		});

		it("should leave instance.constructor undefined", () => {
			expect(instance.constructor).toBeUndefined();
		});

		it("should have no own enumerable keys on Empty.prototype", () => {
			expect(Object.keys(Empty.prototype)).toHaveLength(0);
		});

		it("should have no own keys at all on Empty.prototype, including non-enumerable", () => {
			expect(Object.getOwnPropertyNames(Empty.prototype)).toHaveLength(0);
			expect(Object.getOwnPropertySymbols(Empty.prototype)).toHaveLength(
				0,
			);
		});

		it("should have no constructor property on Empty.prototype after replacement", () => {
			expect("constructor" in Empty.prototype).toBe(false);
		});

		it("should reject properties added to the frozen Empty.prototype", () => {
			const sym = Symbol("a");

			expect(() => {
				Empty.prototype[sym] = "v1";
			}).toThrow(TypeError);
			expect(Reflect.has(instance, sym)).toBe(false);
			expect(instance[sym]).toBeUndefined();
		});
	});

	describe("mutability", () => {
		let instance: Record<PropertyKey, unknown>;

		beforeEach(() => {
			instance = new Empty();
		});

		it("should accept arbitrary string-keyed assignment", () => {
			instance.a = 1;
			instance.b = "v1";

			expect(instance.a).toBe(1);
			expect(instance.b).toBe("v1");
			expect(Object.keys(instance)).toEqual(
				expect.arrayContaining(["a", "b"]),
			);
		});

		it("should report an assigned key as own via Object.hasOwn", () => {
			instance.b = "v1";

			expect(Object.hasOwn(instance, "b")).toBe(true);
			expect(instance.b).toBe("v1");
		});

		it("should accept symbol-keyed assignment", () => {
			const sym = Symbol("a");

			instance[sym] = 1;

			expect(instance[sym]).toBe(1);
		});

		it("should accept numeric-string keys", () => {
			instance["0"] = "v1";
			instance["1"] = "v2";

			expect(instance["0"]).toBe("v1");
			expect(instance["1"]).toBe("v2");
		});

		it("should remove own keys via delete", () => {
			instance.a = 1;

			delete instance.a;

			expect("a" in instance).toBe(false);
		});

		it("should isolate mutations between distinct instances", () => {
			const b = new Empty();

			instance.a = 1;

			expect("a" in b).toBe(false);
		});

		it("should iterate added string keys with for...in", () => {
			instance.a = 1;
			instance.b = 2;

			const keys: string[] = [];

			for (const key in instance) {
				keys.push(key);
			}

			expect(keys).toEqual(expect.arrayContaining(["a", "b"]));
			expect(keys).toHaveLength(2);
		});

		it("should expose both string and symbol own keys via Reflect.ownKeys", () => {
			const sym = Symbol("a");

			instance.a = 1;
			instance[sym] = 2;

			const ownKeys = Reflect.ownKeys(instance);

			expect(ownKeys).toContain("a");
			expect(ownKeys).toContain(sym);
			expect(ownKeys).toHaveLength(2);
		});

		it("should give assigned properties default writable/enumerable/configurable descriptors", () => {
			instance.a = 1;

			expect(Object.getOwnPropertyDescriptor(instance, "a")).toEqual({
				configurable: true,
				enumerable: true,
				value: 1,
				writable: true,
			});
		});

		it("should store __proto__ as an own data key without reassigning the prototype", () => {
			const before = Object.getPrototypeOf(instance);

			instance.__proto__ = "v1";

			expect(instance.__proto__).toBe("v1");
			expect(Object.hasOwn(instance, "__proto__")).toBe(true);
			expect(Object.getPrototypeOf(instance)).toBe(before);
		});
	});

	describe("string coercion", () => {
		it("should throw TypeError on String() since no toString or Symbol.toPrimitive is inherited", () => {
			const instance = new Empty();

			expect(() => String(instance)).toThrow(TypeError);
		});

		it("should throw TypeError on template-literal interpolation", () => {
			const instance = new Empty();

			expect(() => `${instance}`).toThrow(TypeError);
		});
	});

	describe("freezing and sealing instances", () => {
		it("should reject further assignment after Object.freeze", () => {
			const instance = new Empty();

			instance.a = 1;

			Object.freeze(instance);

			expect(Object.isFrozen(instance)).toBe(true);
			expect(() => {
				instance.b = 2;
			}).toThrow();
		});

		it("should reject new assignment after Object.preventExtensions", () => {
			const instance = new Empty();

			Object.preventExtensions(instance);

			expect(Object.isExtensible(instance)).toBe(false);
			expect(() => {
				instance.a = 1;
			}).toThrow();
		});

		it("should lock shape but keep existing properties writable after Object.seal", () => {
			const instance = new Empty();

			instance.a = 1;

			Object.seal(instance);

			expect(Object.isSealed(instance)).toBe(true);

			instance.a = 2;

			expect(instance.a).toBe(2);
			expect(() => {
				instance.b = 3;
			}).toThrow();
		});
	});

	describe("constructor function", () => {
		it("should be a named zero-arity function", () => {
			expect(typeof Empty).toBe("function");
			expect(Empty.name).toBe("Empty");
			expect(Empty.length).toBe(0);
		});

		it("should return undefined when called without new", () => {
			const call = Empty as unknown as () => unknown;

			expect(call()).toBeUndefined();
		});

		it("should ignore constructor arguments", () => {
			expect(Reflect.ownKeys(new Empty({ a: 1 }, "v1"))).toHaveLength(0);
		});

		it("should produce extensible, unfrozen and unsealed instances", () => {
			const instance = new Empty();

			instance.a = 1;

			expect(Object.isExtensible(instance)).toBe(true);
			expect(Object.isFrozen(instance)).toBe(false);
			expect(Object.isSealed(instance)).toBe(false);
		});
	});

	describe("isolation from Object.prototype", () => {
		it("should not be an instance of Object", () => {
			expect(new Empty() instanceof Object).toBe(false);
		});

		it("should not see keys added to Object.prototype", () => {
			const key = "cudenixEmptyProbe";
			const prototype = Object.prototype as Record<string, unknown>;

			prototype[key] = "v1";

			try {
				const instance = new Empty();

				expect(({} as Record<string, unknown>)[key]).toBe("v1");
				expect(key in instance).toBe(false);
				expect(instance[key]).toBeUndefined();
			} finally {
				delete prototype[key];
			}
		});

		it("should not inherit legacy accessors helpers", () => {
			const instance = new Empty();

			expect("__defineGetter__" in instance).toBe(false);
			expect("__lookupGetter__" in instance).toBe(false);
		});

		it("should not be iterable", () => {
			const instance = new Empty();

			expect(Symbol.iterator in instance).toBe(false);
			expect(() => [
				...(instance as unknown as Iterable<unknown>),
			]).toThrow(TypeError);
		});

		it("should still tag as '[object Object]'", () => {
			expect(Object.prototype.toString.call(new Empty())).toBe(
				"[object Object]",
			);
		});
	});

	describe("dictionary usage", () => {
		it("should return undefined and report absence for a missing key", () => {
			const instance = new Empty();

			instance.a = 1;

			expect(instance.b).toBeUndefined();
			expect("b" in instance).toBe(false);
			expect(Object.hasOwn(instance, "b")).toBe(false);
		});

		it("should order integer keys first, then strings, then symbols", () => {
			const instance = new Empty();
			const sym = Symbol("a");

			instance.b = 1;
			instance[sym] = 2;
			instance["2"] = 3;
			instance.a = 4;
			instance["1"] = 5;

			expect(Reflect.ownKeys(instance)).toEqual([
				"1",
				"2",
				"b",
				"a",
				sym,
			]);
		});

		it("should move a deleted and re-added key to the end", () => {
			const instance = new Empty();

			instance.a = 1;
			instance.b = 2;

			delete instance.a;

			instance.a = 3;

			expect(Object.keys(instance)).toEqual(["b", "a"]);
			expect(instance.a).toBe(3);
		});

		it("should hold many dynamic keys and survive deletions", () => {
			const instance = new Empty();

			for (let i = 0; i < 256; i++) {
				instance[`/path/${i}`] = i;
			}

			for (let i = 0; i < 256; i += 2) {
				delete instance[`/path/${i}`];
			}

			expect(Object.keys(instance)).toHaveLength(128);
			expect(instance["/path/0"]).toBeUndefined();
			expect("/path/0" in instance).toBe(false);
			expect(instance["/path/1"]).toBe(1);
			expect(instance["/path/255"]).toBe(255);
			expect(Object.getPrototypeOf(instance)).toBe(Empty.prototype);
		});

		it("should receive own enumerable keys through Object.assign", () => {
			const instance = new Empty();

			const source = { a: 1, constructor: "v1", toString: "v2" };
			const assigned: unknown = Object.assign(instance, source);

			expect(assigned).toBe(instance);
			expect(Object.entries(instance)).toEqual([
				["a", 1],
				["constructor", "v1"],
				["toString", "v2"],
			]);
			expect(Object.getPrototypeOf(instance)).toBe(Empty.prototype);
		});

		it("should overwrite an existing key in place", () => {
			const instance = new Empty();

			instance.a = 1;
			instance.b = 2;
			instance.a = 3;

			expect(Object.entries(instance)).toEqual([
				["a", 3],
				["b", 2],
			]);
		});
	});
});
