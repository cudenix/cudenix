import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { Empty, FreezeEmpty } from "@/utils/objects/empty";

describe("Empty", () => {
	describe("construction", () => {
		test("should produce a non-null object", () => {
			const instance = new Empty();

			expect(typeof instance).toBe("object");
			expect(instance).not.toBeNull();
		});

		test("should have no own keys on a fresh instance", () => {
			const instance = new Empty();

			expect(Object.keys(instance)).toHaveLength(0);
			expect(Reflect.ownKeys(instance)).toHaveLength(0);
		});

		test("should return a fresh instance on each call", () => {
			const a = new Empty();
			const b = new Empty();

			expect(a).not.toBe(b);
		});

		test("should mark instances as instanceof Empty", () => {
			expect(new Empty()).toBeInstanceOf(Empty);
		});
	});

	describe("constructor metadata", () => {
		test("should expose 'Empty' as the constructor name", () => {
			expect(Empty.name).toBe("Empty");
		});

		test("should declare zero formal parameters", () => {
			expect(Empty.length).toBe(0);
		});
	});

	describe("serialization of a fresh instance", () => {
		let instance: Record<PropertyKey, unknown>;

		beforeAll(() => {
			instance = new Empty();
		});

		test("should serialize to '{}' via JSON.stringify", () => {
			expect(JSON.stringify(instance)).toBe("{}");
		});

		test("should spread to an empty object literal", () => {
			expect({ ...instance }).toEqual({});
		});

		test("should return an empty array from Object.entries", () => {
			expect(Object.entries(instance)).toEqual([]);
		});

		test("should return an empty array from Object.values", () => {
			expect(Object.values(instance)).toEqual([]);
		});
	});

	describe("prototype chain", () => {
		let instance: Record<PropertyKey, unknown>;

		beforeAll(() => {
			instance = new Empty();
		});

		test("should inherit from Empty.prototype", () => {
			expect(Object.getPrototypeOf(instance)).toBe(Empty.prototype);
		});

		test("should have a null prototype on Empty.prototype itself", () => {
			expect(Object.getPrototypeOf(Empty.prototype)).toBeNull();
		});

		test("should not have Object.prototype in the instance prototype chain", () => {
			expect(Object.prototype.isPrototypeOf(instance)).toBe(false);
		});

		test("should not expose Object.prototype keys via inheritance", () => {
			expect("toString" in instance).toBe(false);
			expect("hasOwnProperty" in instance).toBe(false);
			expect("constructor" in instance).toBe(false);
			expect(instance["toString"]).toBeUndefined();
		});

		test("should not expose additional Object.prototype keys", () => {
			expect("valueOf" in instance).toBe(false);
			expect("propertyIsEnumerable" in instance).toBe(false);
			expect("isPrototypeOf" in instance).toBe(false);
			expect("toLocaleString" in instance).toBe(false);
			expect(instance["valueOf"]).toBeUndefined();
			expect(instance["propertyIsEnumerable"]).toBeUndefined();
		});

		test("should leave __proto__ accessor undefined on instances", () => {
			expect(instance.__proto__).toBeUndefined();
		});

		test("should yield no keys when iterating with for...in on a fresh instance", () => {
			const keys: string[] = [];

			for (const key in instance) {
				keys.push(key);
			}

			expect(keys).toHaveLength(0);
		});

		test("should leave instance.constructor undefined", () => {
			expect(instance.constructor).toBeUndefined();
		});

		test("should have no own enumerable keys on Empty.prototype", () => {
			expect(Object.keys(Empty.prototype)).toHaveLength(0);
		});

		test("should have no own keys at all on Empty.prototype, including non-enumerable", () => {
			expect(Object.getOwnPropertyNames(Empty.prototype)).toHaveLength(0);
			expect(Object.getOwnPropertySymbols(Empty.prototype)).toHaveLength(
				0,
			);
		});

		test("should have no constructor property on Empty.prototype after replacement", () => {
			expect("constructor" in Empty.prototype).toBe(false);
		});

		test("should propagate properties added to Empty.prototype to instances", () => {
			const probe = Symbol("probe");

			Empty.prototype[probe] = "shared";

			try {
				expect(instance[probe]).toBe("shared");
				expect(Reflect.has(instance, probe)).toBe(true);
				expect(Object.hasOwn(instance, probe)).toBe(false);
			} finally {
				delete Empty.prototype[probe];
			}
		});
	});

	describe("mutability", () => {
		let instance: Record<PropertyKey, unknown>;

		beforeEach(() => {
			instance = new Empty();
		});

		test("should accept arbitrary string-keyed assignment", () => {
			instance.foo = 1;
			instance.bar = "two";

			expect(instance.foo).toBe(1);
			expect(instance.bar).toBe("two");
			expect(Object.keys(instance)).toEqual(
				expect.arrayContaining(["foo", "bar"]),
			);
		});

		test("should accept symbol-keyed assignment", () => {
			const key = Symbol("k");

			instance[key] = 42;

			expect(instance[key]).toBe(42);
		});

		test("should accept numeric-string keys", () => {
			instance["0"] = "zero";
			instance["1"] = "one";

			expect(instance["0"]).toBe("zero");
			expect(instance["1"]).toBe("one");
		});

		test("should remove own keys via delete", () => {
			instance.foo = 1;

			delete instance.foo;

			expect("foo" in instance).toBe(false);
		});

		test("should isolate mutations between distinct instances", () => {
			const other = new Empty();

			instance.foo = 1;

			expect("foo" in other).toBe(false);
		});

		test("should iterate added string keys with for...in", () => {
			instance.foo = 1;
			instance.bar = 2;

			const keys: string[] = [];

			for (const key in instance) {
				keys.push(key);
			}

			expect(keys).toEqual(expect.arrayContaining(["foo", "bar"]));
			expect(keys).toHaveLength(2);
		});

		test("should expose both string and symbol own keys via Reflect.ownKeys", () => {
			const sym = Symbol("s");

			instance.foo = 1;
			instance[sym] = 2;

			const ownKeys = Reflect.ownKeys(instance);

			expect(ownKeys).toContain("foo");
			expect(ownKeys).toContain(sym);
			expect(ownKeys).toHaveLength(2);
		});

		test("should give assigned properties default writable/enumerable/configurable descriptors", () => {
			instance.foo = 1;

			const descriptor = Object.getOwnPropertyDescriptor(instance, "foo");

			expect(descriptor).toEqual({
				configurable: true,
				enumerable: true,
				value: 1,
				writable: true,
			});
		});
	});

	describe("freezing and sealing instances", () => {
		test("should reject further assignment after Object.freeze", () => {
			const instance = new Empty();

			instance.foo = 1;

			Object.freeze(instance);

			expect(Object.isFrozen(instance)).toBe(true);
			expect(() => {
				instance.bar = 2;
			}).toThrow();
		});

		test("should reject new assignment after Object.preventExtensions", () => {
			const instance = new Empty();

			Object.preventExtensions(instance);

			expect(Object.isExtensible(instance)).toBe(false);
			expect(() => {
				instance.foo = 1;
			}).toThrow();
		});

		test("should lock shape but keep existing properties writable after Object.seal", () => {
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
		test("should be of typeof 'object'", () => {
			expect(typeof FreezeEmpty).toBe("object");
		});

		test("should not be null", () => {
			expect(FreezeEmpty).not.toBeNull();
		});

		test("should be frozen", () => {
			expect(Object.isFrozen(FreezeEmpty)).toBe(true);
		});

		test("should be an instance of Empty", () => {
			expect(FreezeEmpty).toBeInstanceOf(Empty);
		});

		test("should be the same reference across re-imports of the module", async () => {
			const reimported = await import("@/utils/objects/empty");

			expect(FreezeEmpty).toBe(reimported.FreezeEmpty);
		});
	});

	describe("shape", () => {
		test("should have no own keys", () => {
			expect(Reflect.ownKeys(FreezeEmpty)).toHaveLength(0);
		});

		test("should report as sealed and non-extensible", () => {
			expect(Object.isSealed(FreezeEmpty)).toBe(true);
			expect(Object.isExtensible(FreezeEmpty)).toBe(false);
		});
	});

	describe("serialization", () => {
		test("should serialize to '{}' via JSON.stringify", () => {
			expect(JSON.stringify(FreezeEmpty)).toBe("{}");
		});

		test("should spread to an empty object literal", () => {
			expect({ ...FreezeEmpty }).toEqual({});
		});

		test("should return an empty array from Object.entries", () => {
			expect(Object.entries(FreezeEmpty)).toEqual([]);
		});

		test("should return an empty array from Object.values", () => {
			expect(Object.values(FreezeEmpty)).toEqual([]);
		});
	});

	describe("prototype chain", () => {
		test("should inherit from the null-prototype Empty.prototype", () => {
			expect(Object.getPrototypeOf(FreezeEmpty)).toBe(Empty.prototype);
			expect(
				Object.getPrototypeOf(Object.getPrototypeOf(FreezeEmpty)),
			).toBeNull();
		});

		test("should not have Object.prototype in the lookup chain", () => {
			expect(Object.prototype.isPrototypeOf(FreezeEmpty)).toBe(false);
		});

		test("should not expose Object.prototype keys", () => {
			expect("toString" in FreezeEmpty).toBe(false);
			expect("hasOwnProperty" in FreezeEmpty).toBe(false);
		});

		test("should leave constructor undefined", () => {
			expect(FreezeEmpty.constructor).toBeUndefined();
		});
	});

	describe("immutability", () => {
		test("should reject property assignment in strict mode", () => {
			expect(() => {
				// @ts-expect-error - should not allow adding properties
				FreezeEmpty.x = 1;
			}).toThrow();
		});

		test("should reject symbol-keyed assignment in strict mode", () => {
			expect(() => {
				// @ts-expect-error - should not allow adding properties
				FreezeEmpty[Symbol("k")] = 1;
			}).toThrow();
		});

		test("should reject defining new properties via Object.defineProperty", () => {
			expect(() =>
				Object.defineProperty(FreezeEmpty, "x", { value: 1 }),
			).toThrow(TypeError);
		});

		test("should reject prototype replacement", () => {
			expect(() => Object.setPrototypeOf(FreezeEmpty, {})).toThrow(
				TypeError,
			);
		});

		test("should be idempotent and return the same reference on re-freeze", () => {
			expect(Object.freeze(FreezeEmpty)).toBe(FreezeEmpty);
			expect(Object.isFrozen(FreezeEmpty)).toBe(true);
		});

		test("should treat Object.seal and Object.preventExtensions as no-ops", () => {
			expect(Object.seal(FreezeEmpty)).toBe(FreezeEmpty);
			expect(Object.preventExtensions(FreezeEmpty)).toBe(FreezeEmpty);
			expect(Object.isFrozen(FreezeEmpty)).toBe(true);
		});
	});

	describe("usage as a destructuring default", () => {
		const fn = ({
			flag = false,
			count = 0,
		}: {
			flag?: boolean;
			count?: number;
		} = FreezeEmpty) => ({ count, flag });

		test("should fall back to defaults when no options are passed", () => {
			expect(fn()).toEqual({ count: 0, flag: false });
		});

		test("should preserve untouched defaults when partial options are passed", () => {
			expect(fn({ flag: true })).toEqual({ count: 0, flag: true });
			expect(fn({ count: 1 })).toEqual({ count: 1, flag: false });
		});
	});
});
