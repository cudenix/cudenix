import { beforeAll, describe, expect, it } from "bun:test";

import { isGenerator } from "@/utils/functions/is-generator";

const asFn = (value: unknown) => value as (...args: any[]) => unknown;

describe("isGenerator", () => {
	describe("synchronous generator functions", () => {
		it("should return true for a generator function declaration", () => {
			function* gen() {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for a generator function expression", () => {
			const gen = function* () {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for a generator method on an object literal", () => {
			const obj = {
				*gen() {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});

		it("should still detect the function reference after its instance has yielded values", () => {
			function* gen() {
				yield 1;
				yield 2;
			}

			const instance = gen();

			instance.next();

			expect(isGenerator(gen)).toBe(true);
		});
	});

	describe("asynchronous generator functions", () => {
		it("should return true for an async generator function declaration", () => {
			async function* gen() {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for an async generator function expression", () => {
			const gen = async function* () {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for an async generator method on an object literal", () => {
			const obj = {
				async *gen() {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});
	});

	describe("generator methods on a class", () => {
		let instance: {
			a: () => Generator<number>;
			b: () => AsyncGenerator<number>;
		};

		beforeAll(() => {
			class A {
				*a() {
					yield 1;
				}

				async *b() {
					yield 1;
				}
			}

			instance = new A();
		});

		it("should return true for a sync generator method", () => {
			expect(isGenerator(instance.a)).toBe(true);
		});

		it("should return true for an async generator method", () => {
			expect(isGenerator(instance.b)).toBe(true);
		});
	});

	describe("regular (non-generator) functions", () => {
		it("should return false for a function declaration", () => {
			function regular() {
				return 1;
			}

			expect(isGenerator(regular)).toBe(false);
		});

		it("should return false for a function expression", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing regular function expressions
			const regular = function () {
				return 1;
			};

			expect(isGenerator(regular)).toBe(false);
		});

		it("should return false for an arrow function", () => {
			const arrow = () => 1;

			expect(isGenerator(arrow)).toBe(false);
		});

		it("should return false for a regular method on an object literal", () => {
			const obj = {
				method() {
					return 1;
				},
			};

			expect(isGenerator(obj.method)).toBe(false);
		});

		it("should return false for a built-in function such as Math.max", () => {
			expect(isGenerator(Math.max)).toBe(false);
		});
	});

	describe("async (non-generator) functions", () => {
		it("should return false for an async function declaration", () => {
			async function asyncFn() {
				return 1;
			}

			expect(isGenerator(asyncFn)).toBe(false);
		});

		it("should return false for an async function expression", () => {
			const asyncFn = async () => 1;

			expect(isGenerator(asyncFn)).toBe(false);
		});

		it("should return false for an async arrow function", () => {
			const asyncArrow = async () => 1;

			expect(isGenerator(asyncArrow)).toBe(false);
		});
	});

	describe("classes and exotic function objects", () => {
		it("should return false for a class declaration", () => {
			class A {}

			expect(isGenerator(asFn(A))).toBe(false);
		});

		it("should return false for a bound function", () => {
			function regular() {
				return 1;
			}

			expect(isGenerator(regular.bind(null))).toBe(false);
		});

		it("should return true for a bound sync generator function", () => {
			function* gen() {
				yield 1;
			}

			expect(isGenerator(gen.bind(null))).toBe(true);
		});

		it("should return true for a bound async generator function", () => {
			async function* gen() {
				yield 1;
			}

			expect(isGenerator(gen.bind(null))).toBe(true);
		});

		it("should return false for a Proxy wrapping a regular function", () => {
			const dynamic = asFn(new Proxy(() => 1, {}));

			expect(isGenerator(dynamic)).toBe(false);
		});

		it("should return true for a Proxy wrapping a generator function", () => {
			const dynamic = asFn(
				new Proxy(function* () {
					yield 1;
				}, {}),
			);

			expect(isGenerator(dynamic)).toBe(true);
		});

		it("should return false for Function.prototype", () => {
			expect(isGenerator(asFn(Function.prototype))).toBe(false);
		});

		it("should return false for a function whose prototype was overridden to null", () => {
			const fn = asFn(() => {});

			Object.setPrototypeOf(fn, null);

			expect(isGenerator(fn)).toBe(false);
		});

		it("should not be fooled by a function spoofing GeneratorFunction via Symbol.toStringTag", () => {
			const fn = asFn(() => {});

			Object.defineProperty(fn, Symbol.toStringTag, {
				value: "GeneratorFunction",
			});

			expect(isGenerator(fn)).toBe(false);
		});

		it("should return false for a generator object instance (not the function)", () => {
			function* gen() {
				yield 1;
			}

			expect(isGenerator(asFn(gen()))).toBe(false);
		});
	});

	describe("non-function values", () => {
		it("should return false for a number primitive", () => {
			expect(isGenerator(asFn(1))).toBe(false);
		});

		it("should return false for a string primitive", () => {
			expect(isGenerator(asFn("v1"))).toBe(false);
		});

		it("should return false for a boolean primitive", () => {
			expect(isGenerator(asFn(true))).toBe(false);
		});

		it("should return false for a plain object", () => {
			expect(isGenerator(asFn({}))).toBe(false);
		});

		it("should return false for an array", () => {
			expect(isGenerator(asFn([]))).toBe(false);
		});
	});

	describe("nullish inputs", () => {
		it("should throw a TypeError for null", () => {
			expect(() => isGenerator(asFn(null))).toThrow(TypeError);
		});

		it("should throw a TypeError for undefined", () => {
			expect(() => isGenerator(asFn(undefined))).toThrow(TypeError);
		});
	});
});
