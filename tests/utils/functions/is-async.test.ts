import { describe, expect, it } from "bun:test";
import { runInNewContext } from "node:vm";

import { isAsync } from "@/utils/functions/is-async";

type Fn = Parameters<typeof isAsync>[0];

const asFn = (value: unknown): Fn => value as Fn;

describe("isAsync", () => {
	describe("async functions", () => {
		it("should return true for an async function declaration", () => {
			async function asyncFn(): Promise<number> {
				return 1;
			}

			expect(isAsync(asyncFn)).toBe(true);
		});

		it("should return true for an async function expression", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing async function expressions
			const asyncFn = async function (): Promise<number> {
				return 1;
			};

			expect(isAsync(asyncFn)).toBe(true);
		});

		it("should return true for an async arrow function", () => {
			expect(isAsync(async (): Promise<number> => 1)).toBe(true);
		});

		it("should return true for an async method on an object literal", () => {
			const obj = {
				async method(): Promise<number> {
					return 1;
				},
			};

			expect(isAsync(obj.method)).toBe(true);
		});
	});

	describe("async methods on a class", () => {
		it("should return true for an async instance method", () => {
			class A {
				async a(): Promise<number> {
					return 1;
				}
			}

			expect(isAsync(new A().a)).toBe(true);
		});

		it("should return true for an async static method", () => {
			class A {
				static async a(): Promise<number> {
					return 1;
				}
			}

			expect(isAsync(A.a)).toBe(true);
		});
	});

	describe("regular (non-async) functions", () => {
		it("should return false for a function declaration", () => {
			function regular(): number {
				return 1;
			}

			expect(isAsync(regular)).toBe(false);
		});

		it("should return false for a function expression", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing regular function expressions
			const regular = function (): number {
				return 1;
			};

			expect(isAsync(regular)).toBe(false);
		});

		it("should return false for an arrow function", () => {
			expect(isAsync((): number => 1)).toBe(false);
		});

		it("should return false for a regular method on an object literal", () => {
			const obj = {
				method(): number {
					return 1;
				},
			};

			expect(isAsync(obj.method)).toBe(false);
		});

		it("should return false for a built-in function such as Math.max", () => {
			expect(isAsync(Math.max)).toBe(false);
		});
	});

	describe("generator functions", () => {
		it("should return false for a sync generator function declaration", () => {
			function* gen(): Generator<number, void, unknown> {
				yield 1;
			}

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for a sync generator function expression", () => {
			const gen = function* (): Generator<number, void, unknown> {
				yield 1;
			};

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for an async generator function declaration", () => {
			async function* gen(): AsyncGenerator<number, void, unknown> {
				yield 1;
			}

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for an async generator function expression", () => {
			const gen = async function* (): AsyncGenerator<
				number,
				void,
				unknown
			> {
				yield 1;
			};

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for an async generator method on an object literal", () => {
			const obj = {
				async *gen(): AsyncGenerator<number, void, unknown> {
					yield 1;
				},
			};

			expect(isAsync(obj.gen)).toBe(false);
		});
	});

	describe("classes and exotic function objects", () => {
		it("should return false for a class declaration", () => {
			class A {}

			expect(isAsync(asFn(A))).toBe(false);
		});

		it("should return true for a bound async function", () => {
			async function asyncFn(): Promise<number> {
				return 1;
			}

			expect(isAsync(asyncFn.bind(null))).toBe(true);
		});

		it("should return false for a bound async generator function", () => {
			async function* gen(): AsyncGenerator<number, void, unknown> {
				yield 1;
			}

			expect(isAsync(gen.bind(null))).toBe(false);
		});

		it("should return false for a bound regular function", () => {
			function regular(): number {
				return 1;
			}

			expect(isAsync(regular.bind(null))).toBe(false);
		});

		it("should return true for a Proxy wrapping an async function", () => {
			expect(isAsync(asFn(new Proxy(async () => 1, {})))).toBe(true);
		});

		it("should return false for a Proxy wrapping a regular function", () => {
			expect(isAsync(asFn(new Proxy(() => 1, {})))).toBe(false);
		});

		it("should return false for Function.prototype", () => {
			expect(isAsync(asFn(Function.prototype))).toBe(false);
		});

		it("should return false for a function whose prototype was overridden to null", () => {
			const fn = asFn(async () => {});

			Object.setPrototypeOf(fn, null);

			expect(isAsync(fn)).toBe(false);
		});

		it("should not be fooled by a function spoofing AsyncFunction via Symbol.toStringTag", () => {
			const fn = asFn(() => {});

			Object.defineProperty(fn, Symbol.toStringTag, {
				value: "AsyncFunction",
			});

			expect(isAsync(fn)).toBe(false);
		});

		it("should return false for the promise returned by calling an async function", () => {
			async function asyncFn(): Promise<number> {
				return 1;
			}

			const promise = asyncFn();

			expect(isAsync(asFn(promise))).toBe(false);

			return promise;
		});
	});

	describe("declaration-based async contract", () => {
		it("should classify Promise-producing functions by their async declaration", () => {
			expect(
				isAsync(async (): Promise<number> => Promise.resolve(1)),
			).toBe(true);
			expect(isAsync((): Promise<number> => Promise.resolve(1))).toBe(
				false,
			);
		});

		it("should return false for a plain arrow that returns a Promise", () => {
			expect(isAsync((): Promise<number> => Promise.resolve(1))).toBe(
				false,
			);
		});

		it("should return false for a plain function expression that returns a Promise", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing promise-returning sync function expressions
			const fn = function (): Promise<number> {
				return Promise.resolve(1);
			};

			expect(isAsync(fn)).toBe(false);
		});
	});

	describe("known limitations of the prototype-identity technique", () => {
		it("should misclassify a re-prototyped arrow function as async (known limitation: prototype identity is spoofable)", () => {
			const fn = asFn(() => {});

			Object.setPrototypeOf(
				fn,
				Object.getPrototypeOf(async () => {}),
			);

			expect(isAsync(fn)).toBe(true);
		});

		it("should misclassify a non-callable object created with the async function prototype as async (known limitation: prototype identity)", () => {
			expect(
				isAsync(
					asFn(Object.create(Object.getPrototypeOf(async () => {}))),
				),
			).toBe(true);
		});

		it("should misclassify a cross-realm async function as non-async (known limitation: prototype identity is per realm)", () => {
			expect(isAsync(asFn(runInNewContext("(async () => {})")))).toBe(
				false,
			);
		});
	});

	describe("prototype lookup semantics", () => {
		const asyncPrototype = Object.getPrototypeOf(async () => {});
		const AsyncFunction = asyncPrototype.constructor;

		it("should return true for a function built with the AsyncFunction constructor", () => {
			expect(isAsync(asFn(new AsyncFunction("return 1")))).toBe(true);
		});

		it("should return true for an async function with extra own properties", () => {
			expect(isAsync(Object.assign(async () => 1, { a: 1, b: 2 }))).toBe(
				true,
			);
		});

		it("should return false for AsyncFunction.prototype itself", () => {
			expect(isAsync(asFn(asyncPrototype))).toBe(false);
		});

		it("should return false for the AsyncFunction constructor", () => {
			expect(isAsync(asFn(AsyncFunction))).toBe(false);
		});

		it("should return false when the async prototype is deeper in the chain", () => {
			const fn = asFn(() => {});

			Object.setPrototypeOf(fn, Object.create(asyncPrototype));

			expect(isAsync(fn)).toBe(false);
		});

		it("should ignore an own constructor property set to AsyncFunction", () => {
			const fn = asFn(() => {});

			Object.defineProperty(fn, "constructor", { value: AsyncFunction });

			expect(isAsync(fn)).toBe(false);
		});

		it("should ignore an own constructor property on an async function", () => {
			const fn = asFn(async () => {});

			Object.defineProperty(fn, "constructor", { value: Function });

			expect(isAsync(fn)).toBe(true);
		});

		it("should ignore an own __proto__ property on a regular function", () => {
			const fn = asFn(() => {});

			Object.defineProperty(fn, "__proto__", { value: asyncPrototype });

			expect(isAsync(fn)).toBe(false);
		});

		it("should ignore an own __proto__ property on an async function", () => {
			const fn = asFn(async () => {});

			Object.defineProperty(fn, "__proto__", {
				value: Function.prototype,
			});

			expect(isAsync(fn)).toBe(true);
		});

		it("should use the getPrototypeOf trap of a Proxy", () => {
			expect(
				isAsync(
					asFn(
						new Proxy(() => 1, {
							getPrototypeOf: () => asyncPrototype,
						}),
					),
				),
			).toBe(true);
			expect(
				isAsync(
					asFn(
						new Proxy(async () => 1, {
							getPrototypeOf: () => Function.prototype,
						}),
					),
				),
			).toBe(false);
		});

		it("should not trigger the get or has traps of a Proxy", () => {
			let calls = 0;

			const dynamic = asFn(
				new Proxy(async () => 1, {
					get: (target, key, receiver) => {
						calls++;

						return Reflect.get(target, key, receiver);
					},
					has: (target, key) => {
						calls++;

						return Reflect.has(target, key);
					},
				}),
			);

			expect(isAsync(dynamic)).toBe(true);
			expect(calls).toBe(0);
		});

		it("should throw a TypeError for a revoked Proxy", () => {
			const { proxy, revoke } = Proxy.revocable(async () => 1, {});

			revoke();

			expect(() => isAsync(asFn(proxy))).toThrow(TypeError);
		});
	});

	describe("non-function values", () => {
		it("should return false for a symbol primitive", () => {
			expect(isAsync(asFn(Symbol("v1")))).toBe(false);
		});

		it("should return false for a bigint primitive", () => {
			expect(isAsync(asFn(1n))).toBe(false);
		});

		it("should return false for an object without a prototype", () => {
			expect(isAsync(asFn(Object.create(null)))).toBe(false);
		});

		it("should return false for a number primitive", () => {
			expect(isAsync(asFn(1))).toBe(false);
		});

		it("should return false for a string primitive", () => {
			expect(isAsync(asFn("v1"))).toBe(false);
		});

		it("should return false for a boolean primitive", () => {
			expect(isAsync(asFn(true))).toBe(false);
		});

		it("should return false for a plain object", () => {
			expect(isAsync(asFn({}))).toBe(false);
		});

		it("should return false for an array", () => {
			expect(isAsync(asFn([]))).toBe(false);
		});
	});

	describe("nullish inputs", () => {
		it("should throw a TypeError for null", () => {
			expect(() => isAsync(asFn(null))).toThrow(TypeError);
		});

		it("should throw a TypeError for undefined", () => {
			expect(() => isAsync(asFn(undefined))).toThrow(TypeError);
		});
	});
});
