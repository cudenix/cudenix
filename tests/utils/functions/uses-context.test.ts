import { describe, expect, it } from "bun:test";

import { usesContext } from "@/utils/functions/uses-context";

const asFn = (value: unknown) => value as (...args: any[]) => unknown;

describe("usesContext", () => {
	describe("functions that declare a parameter", () => {
		it("should return true for an arrow with one parameter", () => {
			expect(usesContext((context) => context)).toBe(true);
		});

		it("should return true for an arrow with a destructured parameter", () => {
			expect(usesContext(({ request }) => request)).toBe(true);
		});

		it("should return true for an arrow with several parameters", () => {
			expect(usesContext((context, next) => [context, next])).toBe(true);
		});

		it("should return true for a function expression with a parameter", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing function expressions
			const fn = function (context: unknown) {
				return context;
			};

			expect(usesContext(fn)).toBe(true);
		});

		it("should return true for a function declaration with a parameter", () => {
			function fn(context: unknown) {
				return context;
			}

			expect(usesContext(fn)).toBe(true);
		});

		it("should return true for an async arrow with a parameter", () => {
			expect(usesContext(async (context) => context)).toBe(true);
		});

		it("should return true for a generator function with a parameter", () => {
			function* gen(context: unknown) {
				yield context;
			}

			expect(usesContext(gen)).toBe(true);
		});

		it("should return true for a method with a parameter on an object literal", () => {
			const obj = {
				method(context: unknown) {
					return context;
				},
			};

			expect(usesContext(obj.method)).toBe(true);
		});

		it("should return true for a bound function that keeps a parameter", () => {
			expect(
				usesContext(((context: unknown) => context).bind(null)),
			).toBe(true);
		});

		it("should return true for a Function-constructor function with a parameter", () => {
			expect(
				usesContext(asFn(new Function("context", "return context"))),
			).toBe(true);
		});
	});

	describe("functions that declare no parameters", () => {
		it("should return false for an arrow with no parameters", () => {
			expect(usesContext(() => 1)).toBe(false);
		});

		it("should return false for an async arrow with no parameters", () => {
			expect(usesContext(async () => 1)).toBe(false);
		});

		it("should return false for a function expression with no parameters", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing function expressions
			const fn = function () {
				return 1;
			};

			expect(usesContext(fn)).toBe(false);
		});

		it("should return false for a function declaration with no parameters", () => {
			function fn() {
				return 1;
			}

			expect(usesContext(fn)).toBe(false);
		});

		it("should return false for a sync generator with no parameters", () => {
			function* gen() {
				yield 1;
			}

			expect(usesContext(gen)).toBe(false);
		});

		it("should return false for an async generator with no parameters", () => {
			async function* gen() {
				yield 1;
			}

			expect(usesContext(gen)).toBe(false);
		});

		it("should return false for a paramless Function-constructor function, whose source has a newline between the parens", () => {
			expect(usesContext(asFn(new Function("return 1")))).toBe(false);
		});
	});

	describe("conservative fallbacks", () => {
		it("should return true for a rest parameter, whose length is zero", () => {
			expect(usesContext((...args: unknown[]) => args[0])).toBe(true);
		});

		it("should return true for a defaulted first parameter, whose length is zero", () => {
			expect(usesContext((context = {}) => context)).toBe(true);
		});

		it("should return true for a function reaching the argument through `arguments`", () => {
			function fn() {
				// biome-ignore lint/complexity/noArguments: Testing the `arguments` fallback
				return arguments[0];
			}

			expect(usesContext(fn)).toBe(true);
		});

		it("should return true for a native built-in with no declared parameters", () => {
			expect(usesContext(Math.random)).toBe(true);
		});

		it("should return true for a bound function whose source is opaque", () => {
			expect(usesContext((() => 1).bind(null))).toBe(true);
		});

		it("should return true for a paramless method shorthand, whose source is not recognized as empty", () => {
			const obj = {
				method() {
					return 1;
				},
			};

			expect(usesContext(obj.method)).toBe(true);
		});

		it("should return true for the substring `arguments` inside a string literal", () => {
			expect(usesContext(() => "arguments")).toBe(true);
		});

		it("should return true for the substring `arguments` inside an identifier", () => {
			const argumentsTotal = Math.random();

			expect(usesContext(() => argumentsTotal)).toBe(true);
		});
	});

	describe("memoization", () => {
		it("should cache the verdict by identity, ignoring a source patched between calls", () => {
			const cached = () => 1;
			const fresh = () => 1;
			const spoofedSource = () => "function () { return arguments[0]; }";

			expect(usesContext(cached)).toBe(false);

			cached.toString = spoofedSource;
			fresh.toString = spoofedSource;

			expect(usesContext(cached)).toBe(false);
			expect(usesContext(fresh)).toBe(true);
		});
	});

	describe("non-function values", () => {
		it("should throw a TypeError for a number primitive, which cannot be cached in the WeakMap", () => {
			expect(() => usesContext(asFn(1))).toThrow(TypeError);
		});

		it("should throw a TypeError for a boolean primitive, which cannot be cached in the WeakMap", () => {
			expect(() => usesContext(asFn(true))).toThrow(TypeError);
		});

		it("should throw a TypeError for an empty string, which cannot be cached in the WeakMap", () => {
			expect(() => usesContext(asFn(""))).toThrow(TypeError);
		});

		it("should return true for a non-empty string, whose length short-circuits before the cache", () => {
			expect(usesContext(asFn("v1"))).toBe(true);
		});

		it("should return true for a plain object, whose source is not recognized as empty", () => {
			expect(usesContext(asFn({}))).toBe(true);
		});

		it("should return true for an array, whose source is not recognized as empty", () => {
			expect(usesContext(asFn([]))).toBe(true);
		});
	});

	describe("nullish inputs", () => {
		it("should throw a TypeError for null", () => {
			expect(() => usesContext(asFn(null))).toThrow(TypeError);
		});

		it("should throw a TypeError for undefined", () => {
			expect(() => usesContext(asFn(undefined))).toThrow(TypeError);
		});
	});
});
