import { describe, expect, it } from "bun:test";
import vm from "node:vm";

import { isAsync } from "@/utils/functions/is-async";

const asFn = (value: unknown) => value as (...args: any[]) => unknown;

describe("isAsync", () => {
	describe("async functions", () => {
		it("should return true for an async function declaration", () => {
			async function asyncFn() {
				return 1;
			}

			expect(isAsync(asyncFn)).toBe(true);
		});

		it("should return true for an async function expression", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing async function expressions
			const asyncFn = async function () {
				return 1;
			};

			expect(isAsync(asyncFn)).toBe(true);
		});

		it("should return true for an async arrow function", () => {
			const asyncArrow = async () => 1;

			expect(isAsync(asyncArrow)).toBe(true);
		});

		it("should return true for an async method on an object literal", () => {
			const obj = {
				async method() {
					return 1;
				},
			};

			expect(isAsync(obj.method)).toBe(true);
		});

		it("should still detect the function reference after its promise resolved", async () => {
			async function asyncFn() {
				return 1;
			}

			await asyncFn();

			expect(isAsync(asyncFn)).toBe(true);
		});
	});

	describe("async methods on a class", () => {
		it("should return true for an async instance method", () => {
			class A {
				async method() {
					return 1;
				}
			}

			expect(isAsync(new A().method)).toBe(true);
		});

		it("should return true for an async static method", () => {
			class A {
				static async staticMethod() {
					return 1;
				}
			}

			expect(isAsync(A.staticMethod)).toBe(true);
		});
	});

	describe("regular (non-async) functions", () => {
		it("should return false for a function declaration", () => {
			function regular() {
				return 1;
			}

			expect(isAsync(regular)).toBe(false);
		});

		it("should return false for a function expression", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing regular function expressions
			const regular = function () {
				return 1;
			};

			expect(isAsync(regular)).toBe(false);
		});

		it("should return false for an arrow function", () => {
			const arrow = () => 1;

			expect(isAsync(arrow)).toBe(false);
		});

		it("should return false for a regular method on an object literal", () => {
			const obj = {
				method() {
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
			function* gen() {
				yield 1;
			}

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for a sync generator function expression", () => {
			const gen = function* () {
				yield 1;
			};

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for an async generator function declaration", () => {
			async function* gen() {
				yield 1;
			}

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for an async generator function expression", () => {
			const gen = async function* () {
				yield 1;
			};

			expect(isAsync(gen)).toBe(false);
		});

		it("should return false for an async generator method on an object literal", () => {
			const obj = {
				async *gen() {
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
			async function asyncFn() {
				return 1;
			}

			expect(isAsync(asyncFn.bind(null))).toBe(true);
		});

		it("should return false for a bound async generator function", () => {
			async function* gen() {
				yield 1;
			}

			expect(isAsync(gen.bind(null))).toBe(false);
		});

		it("should return false for a bound regular function", () => {
			function regular() {
				return 1;
			}

			expect(isAsync(regular.bind(null))).toBe(false);
		});

		it("should return true for a Proxy wrapping an async function", () => {
			const dynamic = asFn(new Proxy(async () => 1, {}));

			expect(isAsync(dynamic)).toBe(true);
		});

		it("should return false for a Proxy wrapping a regular function", () => {
			const dynamic = asFn(new Proxy(() => 1, {}));

			expect(isAsync(dynamic)).toBe(false);
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
			async function asyncFn() {
				return 1;
			}

			const promise = asyncFn();

			expect(isAsync(asFn(promise))).toBe(false);

			return promise;
		});
	});

	describe("declaration-based async contract", () => {
		it("should classify Promise-producing functions by their async declaration", () => {
			const declaredAsync = async () => Promise.resolve(1);
			const plain = () => Promise.resolve(1);

			expect(isAsync(declaredAsync)).toBe(true);
			expect(isAsync(plain)).toBe(false);
		});

		it("should return false for a plain arrow that returns a Promise", () => {
			const fn = () => Promise.resolve(1);

			expect(isAsync(fn)).toBe(false);
		});

		it("should return false for a plain function expression that returns a Promise", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing promise-returning sync function expressions
			const fn = function () {
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
			const obj = asFn(
				Object.create(Object.getPrototypeOf(async () => {})),
			);

			expect(isAsync(obj)).toBe(true);
		});

		it("should misclassify a cross-realm async function as non-async (known limitation: prototype identity is per realm)", () => {
			const crossRealmAsync = asFn(
				vm.runInNewContext("(async () => {})"),
			);

			expect(isAsync(crossRealmAsync)).toBe(false);
		});
	});

	describe("non-function values", () => {
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
