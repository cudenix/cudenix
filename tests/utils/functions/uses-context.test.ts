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
