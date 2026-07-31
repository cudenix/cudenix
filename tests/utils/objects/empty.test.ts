import { beforeAll, beforeEach, describe, expect, it } from "bun:test";

import { Empty, FrozenEmpty } from "@/utils/objects/empty";

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
			const a = new Empty();
			const b = new Empty();

			expect(a).not.toBe(b);
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
		const dangerous: string = "constructor";

		let nested: Record<PropertyKey, unknown>;
		let instance: Record<PropertyKey, unknown>;

		beforeEach(() => {
			nested = new Empty();
			nested.a = 2;

			instance = new Empty();
			instance.a = 1;
			instance.b = nested;
			instance[dangerous] = "v1";
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
			const probe = Symbol();

			expect(() => {
				Empty.prototype[probe] = "v1";
			}).toThrow(TypeError);

			expect(Reflect.has(instance, probe)).toBe(false);
			expect(instance[probe]).toBeUndefined();
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
			const key = Symbol();

			instance[key] = 1;

			expect(instance[key]).toBe(1);
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
			const sym = Symbol();

			instance.a = 1;
			instance[sym] = 2;

			const ownKeys = Reflect.ownKeys(instance);

			expect(ownKeys).toContain("a");
			expect(ownKeys).toContain(sym);
			expect(ownKeys).toHaveLength(2);
		});

		it("should give assigned properties default writable/enumerable/configurable descriptors", () => {
			instance.a = 1;

			const descriptor = Object.getOwnPropertyDescriptor(instance, "a");

			expect(descriptor).toEqual({
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
});

describe("FrozenEmpty", () => {
	describe("identity", () => {
		it("should be of typeof 'object'", () => {
			expect(typeof FrozenEmpty).toBe("object");
		});

		it("should not be null", () => {
			expect(FrozenEmpty).not.toBeNull();
		});

		it("should be frozen", () => {
			expect(Object.isFrozen(FrozenEmpty)).toBe(true);
		});

		it("should be an instance of Empty", () => {
			expect(FrozenEmpty).toBeInstanceOf(Empty);
		});
	});

	describe("shape", () => {
		it("should have no own keys", () => {
			expect(Reflect.ownKeys(FrozenEmpty)).toHaveLength(0);
		});

		it("should report as sealed and non-extensible", () => {
			expect(Object.isSealed(FrozenEmpty)).toBe(true);
			expect(Object.isExtensible(FrozenEmpty)).toBe(false);
		});
	});

	describe("serialization", () => {
		it("should serialize to '{}' via JSON.stringify", () => {
			expect(JSON.stringify(FrozenEmpty)).toBe("{}");
		});

		it("should spread to an empty object literal", () => {
			expect({ ...FrozenEmpty }).toEqual({});
		});

		it("should return an empty array from Object.entries", () => {
			expect(Object.entries(FrozenEmpty)).toEqual([]);
		});

		it("should return an empty array from Object.values", () => {
			expect(Object.values(FrozenEmpty)).toEqual([]);
		});
	});

	describe("prototype chain", () => {
		it("should inherit from the null-prototype Empty.prototype", () => {
			expect(Object.getPrototypeOf(FrozenEmpty)).toBe(Empty.prototype);
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(FrozenEmpty)),
			).toBeNull();
		});

		it("should not have Object.prototype in the lookup chain", () => {
			expect(Object.prototype.isPrototypeOf(FrozenEmpty)).toBe(false);
		});

		it("should not expose Object.prototype keys", () => {
			expect("toString" in FrozenEmpty).toBe(false);
			expect("hasOwnProperty" in FrozenEmpty).toBe(false);
		});

		it("should leave constructor undefined", () => {
			expect(FrozenEmpty.constructor).toBeUndefined();
		});
	});

	describe("immutability", () => {
		it("should reject property assignment in strict mode", () => {
			expect(() => {
				// @ts-expect-error - should not allow adding properties
				FrozenEmpty.a = 1;
			}).toThrow(TypeError);
		});

		it("should reject symbol-keyed assignment in strict mode", () => {
			expect(() => {
				// @ts-expect-error - should not allow adding properties
				FrozenEmpty[Symbol("a")] = 1;
			}).toThrow(TypeError);
		});

		it("should reject defining new properties via Object.defineProperty", () => {
			expect(() =>
				Object.defineProperty(FrozenEmpty, "a", { value: 1 }),
			).toThrow(TypeError);
		});

		it("should reject prototype replacement", () => {
			expect(() => Object.setPrototypeOf(FrozenEmpty, {})).toThrow(
				TypeError,
			);
		});

		it("should be idempotent and return the same reference on re-freeze", () => {
			expect(Object.freeze(FrozenEmpty)).toBe(FrozenEmpty);
			expect(Object.isFrozen(FrozenEmpty)).toBe(true);
		});

		it("should treat Object.seal and Object.preventExtensions as no-ops", () => {
			expect(Object.seal(FrozenEmpty)).toBe(FrozenEmpty);
			expect(Object.preventExtensions(FrozenEmpty)).toBe(FrozenEmpty);
			expect(Object.isFrozen(FrozenEmpty)).toBe(true);
		});
	});

	describe("pollution of the shared Empty.prototype", () => {
		it("should be frozen and non-extensible", () => {
			expect(Object.isFrozen(Empty.prototype)).toBe(true);
			expect(Object.isExtensible(Empty.prototype)).toBe(false);
		});

		it("should reject a string key added to Empty.prototype", () => {
			expect(() => {
				Empty.prototype.a = 1;
			}).toThrow(TypeError);

			expect("a" in FrozenEmpty).toBe(false);
			expect(FrozenEmpty.a).toBeUndefined();
		});

		it("should keep destructuring defaults read through FrozenEmpty stable", () => {
			const fn = ({ a = 1 }: { a?: number } = FrozenEmpty) => a;

			expect(fn()).toBe(1);

			expect(() => {
				Empty.prototype.a = 2;
			}).toThrow(TypeError);

			expect(fn()).toBe(1);
		});

		it("should still let each instance take its own keys", () => {
			const dictionary = new Empty();

			dictionary.a = 1;

			expect(dictionary.a).toBe(1);
			expect(Object.hasOwn(dictionary, "a")).toBe(true);
			expect("a" in new Empty()).toBe(false);
		});
	});

	describe("usage as a destructuring default", () => {
		const fn = ({
			a = false,
			b = 0,
		}: {
			a?: boolean;
			b?: number;
		} = FrozenEmpty) => ({ a, b });

		it("should fall back to defaults when no options are passed", () => {
			expect(fn()).toEqual({ a: false, b: 0 });
		});

		it("should preserve untouched defaults when partial options are passed", () => {
			expect(fn({ a: true })).toEqual({ a: true, b: 0 });
			expect(fn({ b: 1 })).toEqual({ a: false, b: 1 });
		});
	});
});
