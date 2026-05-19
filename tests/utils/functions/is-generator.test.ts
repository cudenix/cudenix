import { describe, expect, test } from "bun:test";

import { isGenerator } from "@/utils/functions/is-generator";

describe("isGenerator", () => {
	describe("returns true for sync generators", () => {
		test("a synchronous generator function declaration", () => {
			function* gen() {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		test("a synchronous generator function expression", () => {
			const gen = function* () {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		test("a generator method on an object literal", () => {
			const obj = {
				*gen() {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});

		test("a generator method on a class", () => {
			class Streamer {
				*stream() {
					yield 1;
				}
			}

			expect(isGenerator(new Streamer().stream)).toBe(true);
		});

		test("a generator that has already yielded values (function reference, not instance)", () => {
			function* gen() {
				yield 1;
				yield 2;
			}

			const instance = gen();

			instance.next();

			expect(isGenerator(gen)).toBe(true);
		});
	});

	describe("returns true for async generators", () => {
		test("an asynchronous generator function declaration", () => {
			async function* gen() {
				yield 1;
			}

			expect(isGenerator(gen)).toBe(true);
		});

		test("an asynchronous generator function expression", () => {
			const gen = async function* () {
				yield 1;
			};

			expect(isGenerator(gen)).toBe(true);
		});

		test("an async generator method on a class", () => {
			class Streamer {
				async *stream() {
					yield 1;
				}
			}

			expect(isGenerator(new Streamer().stream)).toBe(true);
		});

		test("an async generator method on an object literal", () => {
			const obj = {
				async *gen() {
					yield 1;
				},
			};

			expect(isGenerator(obj.gen)).toBe(true);
		});
	});

	describe("returns false for non-generator functions", () => {
		test("a regular function declaration", () => {
			function regular() {
				return 1;
			}

			expect(isGenerator(regular)).toBe(false);
		});

		test("a regular function expression", () => {
			const regular = function () {
				return 1;
			};

			expect(isGenerator(regular)).toBe(false);
		});

		test("an arrow function", () => {
			const arrow = () => 1;

			expect(isGenerator(arrow)).toBe(false);
		});

		test("an async arrow function", () => {
			const asyncArrow = async () => 1;

			expect(isGenerator(asyncArrow)).toBe(false);
		});

		test("an async function declaration", () => {
			async function asyncFn() {
				return 1;
			}

			expect(isGenerator(asyncFn)).toBe(false);
		});

		test("an async function expression", () => {
			const asyncFn = async function () {
				return 1;
			};

			expect(isGenerator(asyncFn)).toBe(false);
		});

		test("a class declaration", () => {
			class Foo {}

			expect(
				isGenerator(Foo as unknown as (...args: any[]) => unknown),
			).toBe(false);
		});

		test("a built-in function (Math.max)", () => {
			expect(isGenerator(Math.max)).toBe(false);
		});

		test("a regular method on an object", () => {
			const obj = {
				method() {
					return 1;
				},
			};

			expect(isGenerator(obj.method)).toBe(false);
		});

		test("a bound function", () => {
			function regular() {
				return 1;
			}

			expect(isGenerator(regular.bind(null))).toBe(false);
		});

		test("a proxy around a regular function", () => {
			const dynamic = new Proxy(() => 1, {}) as (
				...args: any[]
			) => unknown;

			expect(isGenerator(dynamic)).toBe(false);
		});

		test("a function with a manually overridden prototype", () => {
			const fn = (() => {}) as (...args: any[]) => unknown;

			Object.setPrototypeOf(fn, null);

			expect(isGenerator(fn)).toBe(false);
		});

		test("a generator object instance", () => {
			function* gen() {
				yield 1;
			}

			expect(
				isGenerator(gen() as unknown as (...args: any[]) => unknown),
			).toBe(false);
		});

		test("a function with an own generator-looking toStringTag", () => {
			const fn = (() => {}) as (...args: any[]) => unknown;

			Object.defineProperty(fn, Symbol.toStringTag, {
				value: "GeneratorFunction",
			});

			expect(isGenerator(fn)).toBe(false);
		});
	});

	describe("unexpected input types", () => {
		test("throws for null", () => {
			expect(() =>
				isGenerator(null as unknown as (...args: any[]) => unknown),
			).toThrow(TypeError);
		});

		test("throws for undefined", () => {
			expect(() =>
				isGenerator(
					undefined as unknown as (...args: any[]) => unknown,
				),
			).toThrow(TypeError);
		});

		test("returns false for primitive values", () => {
			expect(
				isGenerator(1 as unknown as (...args: any[]) => unknown),
			).toBe(false);
			expect(
				isGenerator("text" as unknown as (...args: any[]) => unknown),
			).toBe(false);
			expect(
				isGenerator(true as unknown as (...args: any[]) => unknown),
			).toBe(false);
		});

		test("returns false for non-function objects and arrays", () => {
			expect(
				isGenerator({} as unknown as (...args: any[]) => unknown),
			).toBe(false);
			expect(
				isGenerator([] as unknown as (...args: any[]) => unknown),
			).toBe(false);
		});
	});
});
