import { describe, expect, test } from "bun:test";

import { Empty, FreezeEmpty } from "@/utils/objects/empty";

describe("Empty", () => {
	describe("construction", () => {
		test("constructs an empty dictionary", () => {
			const instance = new Empty();

			expect(typeof instance).toBe("object");
			expect(instance).not.toBeNull();
			expect(Object.keys(instance)).toHaveLength(0);
			expect(Reflect.ownKeys(instance)).toHaveLength(0);
		});

		test("returns a fresh instance on each call", () => {
			const a = new Empty();
			const b = new Empty();

			expect(a).not.toBe(b);
		});

		test("instances are instanceof Empty", () => {
			expect(new Empty()).toBeInstanceOf(Empty);
		});
	});

	describe("prototype chain", () => {
		test("instances inherit from Empty.prototype", () => {
			const instance = new Empty();

			expect(Object.getPrototypeOf(instance)).toBe(Empty.prototype);
		});

		test("Empty.prototype has a null prototype (no Object.prototype lookup)", () => {
			expect(Object.getPrototypeOf(Empty.prototype)).toBeNull();
		});

		test("Object.prototype is not in the instance prototype chain", () => {
			const instance = new Empty();

			expect(Object.prototype.isPrototypeOf(instance)).toBe(false);
		});

		test("instances do not expose Object.prototype keys via inheritance", () => {
			const instance = new Empty();

			expect("toString" in instance).toBe(false);
			expect("hasOwnProperty" in instance).toBe(false);
			expect("constructor" in instance).toBe(false);
			expect(instance["toString"]).toBeUndefined();
		});

		test("instances do not expose additional Object.prototype keys", () => {
			const instance = new Empty();

			expect("valueOf" in instance).toBe(false);
			expect("propertyIsEnumerable" in instance).toBe(false);
			expect("isPrototypeOf" in instance).toBe(false);
			expect("toLocaleString" in instance).toBe(false);
			expect(instance["valueOf"]).toBeUndefined();
			expect(instance["propertyIsEnumerable"]).toBeUndefined();
		});

		test("__proto__ accessor is undefined on instances (no Object.prototype getter)", () => {
			const instance = new Empty();

			expect(instance.__proto__).toBeUndefined();
		});

		test("for...in does not iterate any keys on a fresh instance", () => {
			const instance = new Empty();

			const keys: string[] = [];

			for (const key in instance) {
				keys.push(key);
			}

			expect(keys).toHaveLength(0);
		});

		test("Empty.prototype itself has no own enumerable keys", () => {
			expect(Object.keys(Empty.prototype)).toHaveLength(0);
		});

		test("Empty.prototype has no own keys at all (including non-enumerable)", () => {
			expect(Object.getOwnPropertyNames(Empty.prototype)).toHaveLength(0);
			expect(Object.getOwnPropertySymbols(Empty.prototype)).toHaveLength(
				0,
			);
		});

		test("Empty.prototype has no constructor property after replacement", () => {
			expect("constructor" in Empty.prototype).toBe(false);
		});

		test("instance.constructor is undefined (no Object.prototype lookup)", () => {
			const instance = new Empty();

			expect(instance.constructor).toBeUndefined();
		});

		test("adding a property to Empty.prototype propagates to instances", () => {
			const probe = Symbol("probe");

			Empty.prototype[probe] = "shared";

			try {
				const instance = new Empty();

				expect(instance[probe]).toBe("shared");
				expect(Reflect.has(instance, probe)).toBe(true);
				expect(Object.hasOwn(instance, probe)).toBe(false);
			} finally {
				delete Empty.prototype[probe];
			}
		});
	});

	describe("serialization", () => {
		test("JSON.stringify yields '{}' for a fresh instance", () => {
			expect(JSON.stringify(new Empty())).toBe("{}");
		});

		test("spreading a fresh instance yields an empty object literal", () => {
			expect({ ...new Empty() }).toEqual({});
		});

		test("Object.entries returns an empty array for a fresh instance", () => {
			expect(Object.entries(new Empty())).toEqual([]);
		});

		test("Object.values returns an empty array for a fresh instance", () => {
			expect(Object.values(new Empty())).toEqual([]);
		});
	});

	describe("constructor metadata", () => {
		test("Empty.name is 'Empty'", () => {
			expect(Empty.name).toBe("Empty");
		});

		test("Empty.length is 0 (constructor takes no arguments)", () => {
			expect(Empty.length).toBe(0);
		});
	});

	describe("mutability", () => {
		test("instances accept arbitrary property assignment", () => {
			const instance = new Empty();

			instance.foo = 1;
			instance.bar = "two";

			expect(instance.foo).toBe(1);
			expect(instance.bar).toBe("two");
			expect(Object.keys(instance)).toEqual(
				expect.arrayContaining(["foo", "bar"]),
			);
		});

		test("instances accept symbol-keyed assignment", () => {
			const instance = new Empty();
			const key = Symbol("k");

			instance[key] = 42;

			expect(instance[key]).toBe(42);
		});

		test("instances accept numeric-string keys", () => {
			const instance = new Empty();

			instance["0"] = "zero";
			instance["1"] = "one";

			expect(instance["0"]).toBe("zero");
			expect(instance["1"]).toBe("one");
		});

		test("delete removes own keys from instances", () => {
			const instance = new Empty();

			instance.foo = 1;

			delete instance.foo;

			expect("foo" in instance).toBe(false);
		});

		test("mutating one instance does not affect another", () => {
			const a = new Empty();
			const b = new Empty();

			a.foo = 1;

			expect("foo" in b).toBe(false);
		});

		test("for...in iterates over added string keys", () => {
			const instance = new Empty();

			instance.foo = 1;
			instance.bar = 2;

			const keys: string[] = [];

			for (const key in instance) {
				keys.push(key);
			}

			expect(keys).toEqual(expect.arrayContaining(["foo", "bar"]));
			expect(keys).toHaveLength(2);
		});

		test("Reflect.ownKeys exposes both string and symbol keys after mutation", () => {
			const instance = new Empty();
			const sym = Symbol("s");

			instance.foo = 1;
			instance[sym] = 2;

			const ownKeys = Reflect.ownKeys(instance);

			expect(ownKeys).toContain("foo");
			expect(ownKeys).toContain(sym);
			expect(ownKeys).toHaveLength(2);
		});

		test("assigned properties get default writable/enumerable/configurable descriptors", () => {
			const instance = new Empty();

			instance.foo = 1;

			const descriptor = Object.getOwnPropertyDescriptor(instance, "foo");

			expect(descriptor).toEqual({
				configurable: true,
				enumerable: true,
				value: 1,
				writable: true,
			});
		});

		test("Object.freeze works on a fresh instance", () => {
			const instance = new Empty();

			instance.foo = 1;

			Object.freeze(instance);

			expect(Object.isFrozen(instance)).toBe(true);
			expect(() => {
				instance.bar = 2;
			}).toThrow();
		});

		test("Object.preventExtensions works on a fresh instance", () => {
			const instance = new Empty();

			Object.preventExtensions(instance);

			expect(Object.isExtensible(instance)).toBe(false);
			expect(() => {
				instance.foo = 1;
			}).toThrow();
		});

		test("Object.seal locks shape but keeps existing properties writable", () => {
			const instance = new Empty();

			instance.foo = 1;

			Object.seal(instance);

			expect(Object.isSealed(instance)).toBe(true);

			instance.foo = 2;

			expect(instance.foo).toBe(2);

			expect(() => {
				instance.bar = 3;
			}).toThrow();
		});
	});
});

describe("FreezeEmpty", () => {
	describe("identity", () => {
		test("typeof is 'object'", () => {
			expect(typeof FreezeEmpty).toBe("object");
		});

		test("is not null", () => {
			expect(FreezeEmpty).not.toBeNull();
		});

		test("is frozen", () => {
			expect(Object.isFrozen(FreezeEmpty)).toBe(true);
		});

		test("is an instance of Empty", () => {
			expect(FreezeEmpty).toBeInstanceOf(Empty);
		});

		test("re-importing the module returns the same reference", async () => {
			const reimported = await import("@/utils/objects/empty");

			expect(FreezeEmpty).toBe(reimported.FreezeEmpty);
		});
	});

	describe("prototype chain", () => {
		test("inherits from the null-prototype Empty.prototype", () => {
			expect(Object.getPrototypeOf(FreezeEmpty)).toBe(Empty.prototype);
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(FreezeEmpty)),
			).toBeNull();
		});

		test("Object.prototype is not in its prototype chain", () => {
			expect(Object.prototype.isPrototypeOf(FreezeEmpty)).toBe(false);
		});

		test("does not expose Object.prototype keys", () => {
			expect("toString" in FreezeEmpty).toBe(false);
			expect("hasOwnProperty" in FreezeEmpty).toBe(false);
		});

		test("constructor is undefined (no Object.prototype lookup)", () => {
			expect(FreezeEmpty.constructor).toBeUndefined();
		});
	});

	describe("shape and immutability", () => {
		test("has no own keys", () => {
			expect(Reflect.ownKeys(FreezeEmpty)).toHaveLength(0);
		});

		test("rejects mutation in strict mode", () => {
			expect(() => {
				// @ts-expect-error - should not allow adding properties
				FreezeEmpty.x = 1;
			}).toThrow();
		});

		test("rejects symbol-keyed mutation in strict mode", () => {
			expect(() => {
				// @ts-expect-error - should not allow adding properties
				FreezeEmpty[Symbol("k")] = 1;
			}).toThrow();
		});

		test("Object.isSealed and Object.isExtensible reflect the frozen state", () => {
			expect(Object.isSealed(FreezeEmpty)).toBe(true);
			expect(Object.isExtensible(FreezeEmpty)).toBe(false);
		});

		test("rejects defining new properties", () => {
			expect(() =>
				Object.defineProperty(FreezeEmpty, "x", {
					value: 1,
				}),
			).toThrow(TypeError);
		});

		test("rejects prototype replacement", () => {
			expect(() => Object.setPrototypeOf(FreezeEmpty, {})).toThrow(
				TypeError,
			);
		});

		test("re-freezing is idempotent and returns the same reference", () => {
			expect(Object.freeze(FreezeEmpty)).toBe(FreezeEmpty);
			expect(Object.isFrozen(FreezeEmpty)).toBe(true);
		});

		test("Object.seal and Object.preventExtensions are no-ops", () => {
			expect(Object.seal(FreezeEmpty)).toBe(FreezeEmpty);
			expect(Object.preventExtensions(FreezeEmpty)).toBe(FreezeEmpty);
			expect(Object.isFrozen(FreezeEmpty)).toBe(true);
		});
	});

	describe("serialization", () => {
		test("JSON.stringify yields '{}'", () => {
			expect(JSON.stringify(FreezeEmpty)).toBe("{}");
		});

		test("spreading yields an empty object literal", () => {
			expect({ ...FreezeEmpty }).toEqual({});
		});

		test("Object.entries returns an empty array", () => {
			expect(Object.entries(FreezeEmpty)).toEqual([]);
		});

		test("Object.values returns an empty array", () => {
			expect(Object.values(FreezeEmpty)).toEqual([]);
		});
	});

	describe("usage", () => {
		test("works as a destructuring default parameter", () => {
			const fn = ({
				flag = false,
				count = 0,
			}: {
				flag?: boolean;
				count?: number;
			} = FreezeEmpty) => ({
				count,
				flag,
			});

			expect(fn()).toEqual({ count: 0, flag: false });
			expect(fn({ flag: true })).toEqual({ count: 0, flag: true });
			expect(fn({ count: 1 })).toEqual({ count: 1, flag: false });
		});
	});
});
