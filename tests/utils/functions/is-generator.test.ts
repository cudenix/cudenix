import { beforeAll, describe, expect, it } from "bun:test";
import { runInNewContext } from "node:vm";

import { isGenerator } from "@/utils/functions/is-generator";

type Fn = Parameters<typeof isGenerator>[0];

const asFn = (value: unknown): Fn => value as Fn;

describe("isGenerator", () => {
	describe("synchronous generator functions", () => {
		it("should return true for a generator function declaration", () => {
			function* gen(): Generator<number, void, unknown> {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for a generator function expression", () => {
			const gen = function* (): Generator<number, void, unknown> {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for a generator method on an object literal", () => {
			const obj = {
				*gen(): Generator<number, void, unknown> {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});
	});

	describe("asynchronous generator functions", () => {
		it("should return true for an async generator function declaration", () => {
			async function* gen(): AsyncGenerator<number, void, unknown> {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for an async generator function expression", () => {
			const gen = async function* (): AsyncGenerator<
				number,
				void,
				unknown
			> {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		it("should return true for an async generator method on an object literal", () => {
			const obj = {
				async *gen(): AsyncGenerator<number, void, unknown> {
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
				*a(): Generator<number, void, unknown> {
					yield 1;
				}

				async *b(): AsyncGenerator<number, void, unknown> {
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
			function regular(): number {
				return 1;
			}

			expect(isGenerator(regular)).toBe(false);
		});

		it("should return false for a function expression", () => {
			const regular = function (): number {
				return 1;
			};

			expect(isGenerator(regular)).toBe(false);
		});

		it("should return false for an arrow function", () => {
			expect(isGenerator((): number => 1)).toBe(false);
		});

		it("should return false for a regular method on an object literal", () => {
			const obj = {
				method(): number {
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
			async function asyncFn(): Promise<number> {
				return 1;
			}

			expect(isGenerator(asyncFn)).toBe(false);
		});

		it("should return false for an async function expression", () => {
			const asyncFn = async function (): Promise<number> {
				return 1;
			};

			expect(isGenerator(asyncFn)).toBe(false);
		});

		it("should return false for an async arrow function", () => {
			expect(isGenerator(async (): Promise<number> => 1)).toBe(false);
		});
	});

	describe("classes and exotic function objects", () => {
		it("should return false for a class declaration", () => {
			class A {}

			expect(isGenerator(asFn(A))).toBe(false);
		});

		it("should return false for a bound function", () => {
			function regular(): number {
				return 1;
			}

			expect(isGenerator(regular.bind(null))).toBe(false);
		});

		it("should return true for a bound sync generator function", () => {
			function* gen(): Generator<number, void, unknown> {
				yield 1;
			}

			expect(isGenerator(gen.bind(null))).toBe(true);
		});

		it("should return true for a bound async generator function", () => {
			async function* gen(): AsyncGenerator<number, void, unknown> {
				yield 1;
			}

			expect(isGenerator(gen.bind(null))).toBe(true);
		});

		it("should return false for a Proxy wrapping a regular function", () => {
			expect(isGenerator(asFn(new Proxy(() => 1, {})))).toBe(false);
		});

		it("should return true for a Proxy wrapping a generator function", () => {
			expect(
				isGenerator(
					asFn(
						new Proxy(function* () {
							yield 1;
						}, {}),
					),
				),
			).toBe(true);
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

		it("should be fooled by an arrow function whose prototype was overridden to the generator function prototype", () => {
			const fn = asFn(() => {});

			Object.setPrototypeOf(
				fn,
				Object.getPrototypeOf(function* () {}),
			);

			expect(isGenerator(fn)).toBe(true);
		});

		it("should return false for a generator object instance (not the function)", () => {
			function* gen(): Generator<number, void, unknown> {
				yield 1;
			}

			expect(isGenerator(asFn(gen()))).toBe(false);
		});

		it("should return false for an async generator object instance (not the function)", () => {
			async function* gen(): AsyncGenerator<number, void, unknown> {
				yield 1;
			}

			expect(isGenerator(asFn(gen()))).toBe(false);
		});

		it("should return false for a cross-realm generator function created via node:vm", () => {
			expect(
				isGenerator(
					asFn(runInNewContext("(function* () { yield 1; })")),
				),
			).toBe(false);
		});
	});

	describe("prototype chain edge cases", () => {
		const generatorFunctionPrototype = Object.getPrototypeOf(
			function* () {},
		) as object;
		const asyncGeneratorFunctionPrototype = Object.getPrototypeOf(
			async function* () {},
		) as object;

		it("should return true for a plain object whose direct prototype is a generator function prototype", () => {
			expect(
				isGenerator(asFn(Object.create(generatorFunctionPrototype))),
			).toBe(true);
			expect(
				isGenerator(
					asFn(Object.create(asyncGeneratorFunctionPrototype)),
				),
			).toBe(true);
		});

		it("should return false when the generator function prototype is not the direct prototype", () => {
			const fn = asFn(() => {});

			Object.setPrototypeOf(
				fn,
				Object.create(generatorFunctionPrototype),
			);

			expect(isGenerator(fn)).toBe(false);
		});

		it("should ignore an own __proto__ property", () => {
			const fn = asFn(() => {});

			Object.defineProperty(fn, "__proto__", {
				value: generatorFunctionPrototype,
			});

			expect(isGenerator(fn)).toBe(false);
		});

		it("should throw a TypeError for a revoked Proxy", () => {
			const { proxy, revoke } = Proxy.revocable(() => 1, {});

			revoke();

			expect(() => isGenerator(asFn(proxy))).toThrow(TypeError);
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
