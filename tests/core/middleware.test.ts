import { describe, expectTypeOf, test } from "bun:test";

import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";
import type {
	AnyMiddleware,
	AnyMiddlewareFn,
	Middleware,
	MiddlewareFn,
} from "@/core/middleware";
import type { AnySuccess } from "@/core/success";
import type { MaybePromise } from "@/types/maybe-promise";
import type { RequiredKeys } from "@/types/required-keys";

describe("MiddlewareFn", () => {
	describe("call signature", () => {
		test("should resolve to a two-parameter function returning the Return type", () => {
			expectTypeOf<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>().toEqualTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
					next: () => MaybePromise<void>,
				) => AnyError
			>();
		});

		test("should type the first parameter as the developer context", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, { a: string }, { b: number }>
				>[0]
			>().toEqualTypeOf<DeveloperContext<{ a: string }, { b: number }>>();
		});

		test("should type the second parameter as a `next` continuation", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, { a: string }, { b: number }>
				>[1]
			>().toEqualTypeOf<() => MaybePromise<void>>();
		});

		test("should declare exactly two parameters", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, { a: string }, { b: number }>
				>["length"]
			>().toEqualTypeOf<2>();
		});
	});

	describe("Return parameter", () => {
		test("should thread `void` through to the return type", () => {
			expectTypeOf<
				ReturnType<MiddlewareFn<void, { a: string }, { b: number }>>
			>().toEqualTypeOf<void>();
		});

		test("should thread an error envelope through to the return type", () => {
			expectTypeOf<
				ReturnType<MiddlewareFn<AnyError, { a: string }, { b: number }>>
			>().toEqualTypeOf<AnyError>();
		});

		test("should thread a success envelope through to the return type", () => {
			expectTypeOf<
				ReturnType<
					MiddlewareFn<AnySuccess, { a: string }, { b: number }>
				>
			>().toEqualTypeOf<AnySuccess>();
		});

		test("should thread a promise-wrapped union through to the return type", () => {
			// biome-ignore lint/suspicious/noConfusingVoidType: void is the defer-to-chain arm of the MiddlewareFn return contract
			type Return = MaybePromise<AnyError | AnySuccess | void>;

			expectTypeOf<
				ReturnType<MiddlewareFn<Return, { a: string }, { b: number }>>
			>().toEqualTypeOf<Return>();
		});
	});

	describe("Stores parameter", () => {
		test("should type `context.store` as the Stores parameter", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, { a: string }, { b: number }>
				>[0]["store"]
			>().toEqualTypeOf<{ a: string }>();
		});
	});

	describe("Validators parameter", () => {
		test("should merge the Validators parameter into `context.request`", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, { a: string }, { b: number }>
				>[0]["request"]["b"]
			>().toEqualTypeOf<number>();
		});

		test("should keep `context.request.raw` typed as a `Request`", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, { a: string }, { b: number }>
				>[0]["request"]["raw"]
			>().toEqualTypeOf<Request>();
		});
	});

	describe("assignable middleware shapes", () => {
		test("should accept a zero-argument handler that ignores the context", () => {
			expectTypeOf<() => void>().toExtend<
				MiddlewareFn<void, { a: string }, { b: number }>
			>();
		});

		test("should accept an async handler that awaits `next`", () => {
			expectTypeOf<
				MiddlewareFn<Promise<void>, { a: string }, { b: number }>
			>().toExtend<
				MiddlewareFn<MaybePromise<void>, { a: string }, { b: number }>
			>();
		});

		test("should accept a handler that omits `next` to halt the chain", () => {
			expectTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
				) => AnyError
			>().toExtend<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>();
		});

		test("should accept a narrower return through return covariance", () => {
			expectTypeOf<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>().toExtend<
				MiddlewareFn<
					AnyError | AnySuccess,
					{ a: string },
					{ b: number }
				>
			>();
		});
	});

	describe("rejected middleware shapes", () => {
		test("should reject a handler returning an unrelated type", () => {
			expectTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
					next: () => MaybePromise<void>,
				) => string
			>().not.toExtend<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>();
		});

		test("should reject a handler that requires a third parameter", () => {
			expectTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
					next: () => MaybePromise<void>,
					extra: string,
				) => void
			>().not.toExtend<
				MiddlewareFn<void, { a: string }, { b: number }>
			>();
		});

		test("should reject a success return where an error is expected", () => {
			expectTypeOf<
				MiddlewareFn<AnySuccess, { a: string }, { b: number }>
			>().not.toExtend<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>();
		});
	});

	describe("empty store and validator shapes", () => {
		type Empty = NonNullable<unknown>;

		test("should reduce `context.request` to just the raw request", () => {
			expectTypeOf<
				Parameters<
					MiddlewareFn<AnyError, Empty, Empty>
				>[0]["request"]["raw"]
			>().toEqualTypeOf<Request>();
		});

		test("should type `context.store` as an empty object", () => {
			expectTypeOf<
				Parameters<MiddlewareFn<AnyError, Empty, Empty>>[0]["store"]
			>().toEqualTypeOf<Empty>();
		});
	});

	describe("AnyMiddlewareFn", () => {
		test("should resolve to `MiddlewareFn<any, any, any>`", () => {
			expectTypeOf<AnyMiddlewareFn>().toEqualTypeOf<
				MiddlewareFn<any, any, any>
			>();
		});

		test("should accept any concrete middleware function as a subtype", () => {
			expectTypeOf<
				MiddlewareFn<void, { a: string }, { b: number }>
			>().toExtend<AnyMiddlewareFn>();
		});

		test("should accept an error-returning middleware function", () => {
			expectTypeOf<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>().toExtend<AnyMiddlewareFn>();
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				MiddlewareFn<void, { a: string }, { b: number }>[]
			>().toExtend<AnyMiddlewareFn[]>();
		});
	});
});

describe("Middleware", () => {
	describe("structure", () => {
		test("should type `handler` as the parametrized middleware function", () => {
			expectTypeOf<
				Middleware<AnyError, { a: string }, { b: number }>["handler"]
			>().toEqualTypeOf<
				MiddlewareFn<AnyError, { a: string }, { b: number }>
			>();
		});

		test('should fix `type` to the `"MIDDLEWARE"` literal', () => {
			expectTypeOf<
				Middleware<AnyError, { a: string }, { b: number }>["type"]
			>().toEqualTypeOf<"MIDDLEWARE">();
		});

		test("should mark both `handler` and `type` as required", () => {
			expectTypeOf<
				RequiredKeys<Middleware<AnyError, { a: string }, { b: number }>>
			>().toEqualTypeOf<"handler" | "type">();
		});
	});

	describe("accepted descriptors", () => {
		test('should accept a handler paired with the `"MIDDLEWARE"` tag', () => {
			expectTypeOf<{
				handler: MiddlewareFn<AnyError, { a: string }, { b: number }>;
				type: "MIDDLEWARE";
			}>().toExtend<Middleware<AnyError, { a: string }, { b: number }>>();
		});
	});

	describe("rejected descriptors", () => {
		test('should reject a `type` other than `"MIDDLEWARE"`', () => {
			expectTypeOf<{
				handler: MiddlewareFn<AnyError, { a: string }, { b: number }>;
				type: "GROUP";
			}>().not.toExtend<
				Middleware<AnyError, { a: string }, { b: number }>
			>();
		});

		test("should reject a descriptor missing `handler`", () => {
			expectTypeOf<{ type: "MIDDLEWARE" }>().not.toExtend<
				Middleware<AnyError, { a: string }, { b: number }>
			>();
		});

		test("should reject a descriptor missing `type`", () => {
			expectTypeOf<{
				handler: MiddlewareFn<AnyError, { a: string }, { b: number }>;
			}>().not.toExtend<
				Middleware<AnyError, { a: string }, { b: number }>
			>();
		});
	});

	describe("AnyMiddleware", () => {
		test("should resolve to `Middleware<any, any, any>`", () => {
			expectTypeOf<AnyMiddleware>().toEqualTypeOf<
				Middleware<any, any, any>
			>();
		});

		test("should accept any concrete middleware descriptor as a subtype", () => {
			expectTypeOf<
				Middleware<AnyError, { a: string }, { b: number }>
			>().toExtend<AnyMiddleware>();
		});

		test('should keep `type` fixed to `"MIDDLEWARE"`', () => {
			expectTypeOf<AnyMiddleware["type"]>().toEqualTypeOf<"MIDDLEWARE">();
		});

		test("should keep `handler` present", () => {
			expectTypeOf<AnyMiddleware>().toHaveProperty("handler");
		});

		test("should keep `type` present", () => {
			expectTypeOf<AnyMiddleware>().toHaveProperty("type");
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				Middleware<AnyError, { a: string }, { b: number }>[]
			>().toExtend<AnyMiddleware[]>();
		});
	});
});
