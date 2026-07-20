import { describe, expect, it } from "bun:test";

import {
	usesContext,
	usesResponseMetadata,
} from "@/utils/functions/uses-context";

const asFn = (value: unknown) => value as (...args: any[]) => unknown;

describe("usesContext", () => {
	describe("functions that use the first parameter", () => {
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

		it("should return true for a bare arrow parameter", () => {
			const fn = asFn(new Function("return context => context")());

			expect(usesContext(fn)).toBe(true);
		});
	});

	describe("functions with an unused simple first parameter", () => {
		it("should return false for an unused arrow parameter", () => {
			expect(usesContext((_context) => 1)).toBe(false);
		});

		it("should return false when only a middleware's next parameter is used", () => {
			expect(usesContext((_context, next) => next())).toBe(false);
		});

		it("should return false when an async middleware only uses next", () => {
			expect(
				usesContext(async (_context, next) => {
					await next();
				}),
			).toBe(false);
		});

		it("should not depend on an underscore naming convention", () => {
			// biome-ignore lint/correctness/noUnusedFunctionParameters: Testing the unused parameter name
			const fn = (context: unknown, next: () => unknown) => next();

			expect(usesContext(fn)).toBe(false);
		});

		it("should return false for an unused function-expression parameter", () => {
			// biome-ignore lint/complexity/useArrowFunction: Testing function expressions
			const fn = function (_context: unknown, next: () => unknown) {
				return next();
			};

			expect(usesContext(fn)).toBe(false);
		});

		it("should return false for an unused method parameter", () => {
			const obj = {
				method(_context: unknown, next: () => unknown) {
					return next();
				},
			};

			expect(usesContext(obj.method)).toBe(false);
		});

		it("should return false for an unused generator parameter", () => {
			function* gen(_context: unknown) {
				yield 1;
			}

			expect(usesContext(gen)).toBe(false);
		});

		it("should return false for an unused Function-constructor parameter", () => {
			expect(
				usesContext(asFn(new Function("_context", "return 1"))),
			).toBe(false);
		});

		it("should return false for an unused bare arrow parameter", () => {
			const fn = asFn(new Function("return _context => 1")());

			expect(usesContext(fn)).toBe(false);
		});

		it("should return false for an unused bare async arrow parameter", () => {
			const fn = asFn(new Function("return async _context => 1")());

			expect(usesContext(fn)).toBe(false);
		});

		it("should not confuse a longer identifier for the parameter", () => {
			const _contextual = 1;

			expect(usesContext((_context) => _contextual)).toBe(false);
		});

		it("should not confuse the parameter inside other ASCII word identifiers", () => {
			const pre_context = 1;
			const _context0 = 2;
			const _contextA = 3;
			const _context_ = 4;

			expect(
				usesContext(
					(_context) =>
						pre_context + _context0 + _contextA + _context_,
				),
			).toBe(false);
		});

		it("should keep searching after a longer identifier", () => {
			const _contextual = 1;

			expect(usesContext((_context) => [_contextual, _context])).toBe(
				true,
			);
		});

		it("should detect a first parameter used by a later default", () => {
			expect(
				usesContext((context: unknown, next = () => context) => next()),
			).toBe(true);
		});

		it("should return false for a later default that does not use the first parameter", () => {
			expect(
				usesContext((_context: unknown, next = () => 1) => next()),
			).toBe(false);
		});

		it("should return false for a later rest parameter that does not use the first parameter", () => {
			expect(
				usesContext((_context: unknown, ...args: unknown[]) => args[0]),
			).toBe(false);
		});

		it("should return false for an unused async function parameter", () => {
			async function fn(_context: unknown, next: () => unknown) {
				return next();
			}

			expect(usesContext(fn)).toBe(false);
		});

		it("should return false for an unused async generator-method parameter", () => {
			const obj = {
				async *method(_context: unknown) {
					yield 1;
				},
			};

			expect(usesContext(obj.method)).toBe(false);
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

		it("should return false for a paramless method shorthand", () => {
			const obj = {
				method() {
					return 1;
				},
			};

			expect(usesContext(obj.method)).toBe(false);
		});

		it("should return false for a paramless async generator method", () => {
			const obj = {
				async *method() {
					yield 1;
				},
			};

			expect(usesContext(obj.method)).toBe(false);
		});
	});

	describe("conservative fallbacks", () => {
		it("should return true for a rest parameter, whose length is zero", () => {
			expect(usesContext((...args: unknown[]) => args[0])).toBe(true);
		});

		it("should return true for a defaulted first parameter, whose length is zero", () => {
			expect(usesContext((context = {}) => context)).toBe(true);
		});

		it("should return true for an unused defaulted first parameter", () => {
			expect(usesContext((_context = {}, next) => next())).toBe(true);
		});

		it("should return true for unused destructuring of the first parameter", () => {
			expect(usesContext(({ request: _request }, next) => next())).toBe(
				true,
			);
		});

		it("should return true for a function reaching the argument through `arguments`", () => {
			function fn() {
				// biome-ignore lint/complexity/noArguments: Testing the `arguments` fallback
				return arguments[0];
			}

			expect(usesContext(fn)).toBe(true);
		});

		it("should return true when a declared parameter is reached through `arguments`", () => {
			function fn(_context: unknown) {
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

		it("should return true for a callable proxy whose source is opaque", () => {
			const fn = new Proxy(() => 1, {
				apply(_target, _thisArgument, args) {
					return args[0];
				},
			});

			expect(usesContext(fn)).toBe(true);
		});

		it("should return true for the substring `arguments` inside a string literal", () => {
			expect(usesContext(() => "arguments")).toBe(true);
		});

		it("should return true for the substring `arguments` inside an identifier", () => {
			const argumentsTotal = Math.random();

			expect(usesContext(() => argumentsTotal)).toBe(true);
		});

		it("should return true for dynamic access through eval", () => {
			const fn = asFn(
				new Function("context", 'return eval("arg" + "uments[0]")'),
			);

			expect(usesContext(fn)).toBe(true);
		});

		it("should return true for an escaped reference to the first parameter", () => {
			const fn = asFn(new Function("context", "return cont\\u0065xt"));

			expect(usesContext(fn)).toBe(true);
		});
	});

	describe("memoization", () => {
		it("should ignore own toString overrides and preserve cached verdicts", () => {
			const cached = () => 1;
			const fresh = () => 1;
			const spoofedSource = () => "function () { return arguments[0]; }";

			expect(usesContext(cached)).toBe(false);

			cached.toString = spoofedSource;
			fresh.toString = spoofedSource;

			expect(usesContext(cached)).toBe(false);
			expect(usesContext(fresh)).toBe(false);
		});
	});
});

describe("usesResponseMetadata", () => {
	describe("metadata-independent access", () => {
		it("should return false when the context is unused", () => {
			expect(usesResponseMetadata((_context) => "v1")).toBe(false);
		});

		it("should return false for direct request, store, memory, server, and match access", () => {
			expect(usesResponseMetadata((context) => context.request)).toBe(
				false,
			);
			expect(usesResponseMetadata((context) => context.store)).toBe(
				false,
			);
			expect(usesResponseMetadata((context) => context.memory)).toBe(
				false,
			);
			expect(usesResponseMetadata((context) => context.server)).toBe(
				false,
			);
			expect(usesResponseMetadata((context) => context.match)).toBe(
				false,
			);
		});

		it("should accept optional chaining and whitespace before a known property", () => {
			const optional = asFn(
				new Function("return context => context?.request.raw")(),
			);
			const spaced = asFn(
				new Function("return context => context \n . store")(),
			);

			expect(usesResponseMetadata(optional)).toBe(false);
			expect(usesResponseMetadata(spaced)).toBe(false);
		});
	});

	describe("full-context fallbacks", () => {
		it("should return true for response access", () => {
			expect(usesResponseMetadata((context) => context.response)).toBe(
				true,
			);
		});

		it("should return true when the complete context escapes", () => {
			expect(usesResponseMetadata((context) => context)).toBe(true);
			expect(
				usesResponseMetadata((context) => [context.request, context]),
			).toBe(true);
		});

		it("should return true for destructuring, computed access, and unknown properties", () => {
			const requestKey = Date.now() > 0 ? "request" : "response";
			const suffixedProperty = asFn(
				new Function("return context => context.request$custom")(),
			);
			const unicodeProperty = asFn(
				new Function("return context => context.requesté")(),
			);

			expect(usesResponseMetadata(({ request }) => request)).toBe(true);
			expect(
				usesResponseMetadata(
					(context) =>
						(context as unknown as Record<string, unknown>)[
							requestKey
						],
				),
			).toBe(true);
			expect(
				usesResponseMetadata(
					(context) =>
						(context as unknown as Record<string, unknown>).unknown,
				),
			).toBe(true);
			expect(usesResponseMetadata(suffixedProperty)).toBe(true);
			expect(usesResponseMetadata(unicodeProperty)).toBe(true);
		});

		it("should return true for arguments, eval, native, and bound functions", () => {
			function throughArguments(_context: unknown) {
				// biome-ignore lint/complexity/noArguments: Testing the conservative fallback
				return arguments[0];
			}

			const throughEval = asFn(
				new Function("context", 'return eval("context")'),
			);

			expect(usesResponseMetadata(throughArguments)).toBe(true);
			expect(usesResponseMetadata(throughEval)).toBe(true);
			expect(usesResponseMetadata(Math.random)).toBe(true);
			expect(usesResponseMetadata((() => "v1").bind(null))).toBe(true);
		});
	});

	describe("memoization", () => {
		it("should ignore own toString overrides and preserve cached verdicts", () => {
			const cached = (context: { request: unknown }) => context.request;
			const responseHandler = (context: {
				response: { headers: unknown };
			}) => context.response.headers;
			const spoofedSource = () => "context => context.request.raw";

			expect(usesResponseMetadata(cached)).toBe(false);

			cached.toString = spoofedSource;
			responseHandler.toString = spoofedSource;

			expect(usesResponseMetadata(cached)).toBe(false);
			expect(usesResponseMetadata(responseHandler)).toBe(true);
		});
	});
});
