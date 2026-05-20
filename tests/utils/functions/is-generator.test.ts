import { beforeAll, describe, expect, test } from "bun:test";

import { isGenerator } from "@/utils/functions/is-generator";

const asFn = (value: unknown) => value as (...args: any[]) => unknown;

describe("isGenerator", () => {
	describe("synchronous generator functions", () => {
		test("should return true for a generator function declaration", () => {
			function* gen() {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		test("should return true for a generator function expression", () => {
			const gen = function* () {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		test("should return true for a generator method on an object literal", () => {
			const obj = {
				*gen() {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});

		test("should still detect the function reference after its instance has yielded values", () => {
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
		test("should return true for an async generator function declaration", () => {
			async function* gen() {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		test("should return true for an async generator function expression", () => {
			const gen = async function* () {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		test("should return true for an async generator method on an object literal", () => {
			const obj = {
				async *gen() {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});
	});

	describe("generator methods on a class", () => {
		let streamer: {
			stream: () => Generator<number>;
			streamAsync: () => AsyncGenerator<number>;
		};

		beforeAll(() => {
			class Streamer {
				*stream() {
					yield 1;
				}

				async *streamAsync() {
					yield 1;
				}
			}

			streamer = new Streamer();
		});

		test("should return true for a sync generator method", () => {
			expect(isGenerator(streamer.stream)).toBe(true);
		});

		test("should return true for an async generator method", () => {
			expect(isGenerator(streamer.streamAsync)).toBe(true);
		});
	});

	describe("regular (non-generator) functions", () => {
		test("should return false for a function declaration", () => {
			function regular() {
				return 1;
			}

			expect(isGenerator(regular)).toBe(false);
		});

		test("should return false for a function expression", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing regular function expressions
			const regular = function () {
				return 1;
			};

			expect(isGenerator(regular)).toBe(false);
		});

		test("should return false for an arrow function", () => {
			const arrow = () => 1;

			expect(isGenerator(arrow)).toBe(false);
		});

		test("should return false for a regular method on an object literal", () => {
			const obj = {
				method() {
					return 1;
				},
			};

			expect(isGenerator(obj.method)).toBe(false);
		});

		test("should return false for a built-in function such as Math.max", () => {
			expect(isGenerator(Math.max)).toBe(false);
		});
	});

	describe("async (non-generator) functions", () => {
		test("should return false for an async function declaration", () => {
			async function asyncFn() {
				return 1;
			}

			expect(isGenerator(asyncFn)).toBe(false);
		});

		test("should return false for an async function expression", () => {
			const asyncFn = async () => 1;

			expect(isGenerator(asyncFn)).toBe(false);
		});

		test("should return false for an async arrow function", () => {
			const asyncArrow = async () => 1;

			expect(isGenerator(asyncArrow)).toBe(false);
		});
	});

	describe("classes and exotic function objects", () => {
		test("should return false for a class declaration", () => {
			class Foo {}

			expect(isGenerator(asFn(Foo))).toBe(false);
		});

		test("should return false for a bound function", () => {
			function regular() {
				return 1;
			}

			expect(isGenerator(regular.bind(null))).toBe(false);
		});

		test("should return false for a Proxy wrapping a regular function", () => {
			const dynamic = asFn(new Proxy(() => 1, {}));

			expect(isGenerator(dynamic)).toBe(false);
		});

		test("should return false for a function whose prototype was overridden to null", () => {
			const fn = asFn(() => {});

			Object.setPrototypeOf(fn, null);

			expect(isGenerator(fn)).toBe(false);
		});

		test("should not be fooled by a function spoofing GeneratorFunction via Symbol.toStringTag", () => {
			const fn = asFn(() => {});

			Object.defineProperty(fn, Symbol.toStringTag, {
				value: "GeneratorFunction",
			});

			expect(isGenerator(fn)).toBe(false);
		});

		test("should return false for a generator object instance (not the function)", () => {
			function* gen() {
				yield 1;
			}

			expect(isGenerator(asFn(gen()))).toBe(false);
		});
	});

	describe("non-function values", () => {
		test("should return false for a number primitive", () => {
			expect(isGenerator(asFn(1))).toBe(false);
		});

		test("should return false for a string primitive", () => {
			expect(isGenerator(asFn("text"))).toBe(false);
		});

		test("should return false for a boolean primitive", () => {
			expect(isGenerator(asFn(true))).toBe(false);
		});

		test("should return false for a plain object", () => {
			expect(isGenerator(asFn({}))).toBe(false);
		});

		test("should return false for an array", () => {
			expect(isGenerator(asFn([]))).toBe(false);
		});
	});

	describe("nullish inputs", () => {
		test("should throw a TypeError for null", () => {
			expect(() => isGenerator(asFn(null))).toThrow(TypeError);
		});

		test("should throw a TypeError for undefined", () => {
			expect(() => isGenerator(asFn(undefined))).toThrow(TypeError);
		});
	});
});
