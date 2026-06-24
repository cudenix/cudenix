import { beforeAll, describe, expect, it } from "bun:test";

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
		let instance: { method: () => Promise<number> };
		let staticMethod: () => Promise<number>;

		beforeAll(() => {
			class A {
				static async staticMethod() {
					return 1;
				}

				async method() {
					return 1;
				}
			}

			instance = new A();
			staticMethod = A.staticMethod;
		});

		it("should return true for an async instance method", () => {
			expect(isAsync(instance.method)).toBe(true);
		});

		it("should return true for an async static method", () => {
			expect(isAsync(staticMethod)).toBe(true);
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
