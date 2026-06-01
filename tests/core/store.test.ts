import { describe, expectTypeOf, test } from "bun:test";

import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";
import type { AnyStore, AnyStoreFn, Store, StoreFn } from "@/core/store";
import type { MaybePromise } from "@/utils/types/maybe-promise";
import type { RequiredKeys } from "@/utils/types/required-keys";

describe("StoreFn", () => {
	describe("call signature", () => {
		test("should resolve to a single-parameter function returning the Return type", () => {
			expectTypeOf<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>().toEqualTypeOf<
				(context: DeveloperContext<{ a: string }, { b: number }>) => {
					c: boolean;
				}
			>();
		});

		test("should type the parameter as the developer context", () => {
			expectTypeOf<
				Parameters<
					StoreFn<{ c: boolean }, { a: string }, { b: number }>
				>[0]
			>().toEqualTypeOf<DeveloperContext<{ a: string }, { b: number }>>();
		});

		test("should declare exactly one parameter", () => {
			expectTypeOf<
				Parameters<
					StoreFn<{ c: boolean }, { a: string }, { b: number }>
				>["length"]
			>().toEqualTypeOf<1>();
		});
	});

	describe("Return parameter", () => {
		test("should thread a plain record through to the return type", () => {
			expectTypeOf<
				ReturnType<
					StoreFn<{ c: boolean }, { a: string }, { b: number }>
				>
			>().toEqualTypeOf<{ c: boolean }>();
		});

		test("should thread an error envelope through to the return type", () => {
			expectTypeOf<
				ReturnType<StoreFn<AnyError, { a: string }, { b: number }>>
			>().toEqualTypeOf<AnyError>();
		});

		test("should thread a record-or-error union through to the return type", () => {
			expectTypeOf<
				ReturnType<
					StoreFn<
						{ c: boolean } | AnyError,
						{ a: string },
						{ b: number }
					>
				>
			>().toEqualTypeOf<{ c: boolean } | AnyError>();
		});

		test("should thread a promise-wrapped union through to the return type", () => {
			expectTypeOf<
				ReturnType<
					StoreFn<
						MaybePromise<{ c: boolean } | AnyError>,
						{ a: string },
						{ b: number }
					>
				>
			>().toEqualTypeOf<MaybePromise<{ c: boolean } | AnyError>>();
		});
	});

	describe("Stores parameter", () => {
		test("should type `context.store` as the Stores parameter", () => {
			expectTypeOf<
				Parameters<
					StoreFn<{ c: boolean }, { a: string }, { b: number }>
				>[0]["store"]
			>().toEqualTypeOf<{ a: string }>();
		});
	});

	describe("Validators parameter", () => {
		test("should merge the Validators parameter into `context.request`", () => {
			expectTypeOf<
				Parameters<
					StoreFn<{ c: boolean }, { a: string }, { b: number }>
				>[0]["request"]["b"]
			>().toEqualTypeOf<number>();
		});

		test("should keep `context.request.raw` typed as a `Request`", () => {
			expectTypeOf<
				Parameters<
					StoreFn<{ c: boolean }, { a: string }, { b: number }>
				>[0]["request"]["raw"]
			>().toEqualTypeOf<Request>();
		});
	});

	describe("assignable store shapes", () => {
		test("should accept a zero-argument factory that ignores the context", () => {
			expectTypeOf<() => { c: boolean }>().toExtend<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>();
		});

		test("should accept an async handler returning a promised record", () => {
			expectTypeOf<
				StoreFn<Promise<{ c: boolean }>, { a: string }, { b: number }>
			>().toExtend<
				StoreFn<
					MaybePromise<{ c: boolean }>,
					{ a: string },
					{ b: number }
				>
			>();
		});

		test("should accept a handler returning an error envelope", () => {
			expectTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
				) => AnyError
			>().toExtend<StoreFn<AnyError, { a: string }, { b: number }>>();
		});

		test("should accept a narrower return through return covariance", () => {
			expectTypeOf<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>().toExtend<
				StoreFn<{ c: boolean } | AnyError, { a: string }, { b: number }>
			>();
		});
	});

	describe("rejected store shapes", () => {
		test("should reject a handler returning an unrelated type", () => {
			expectTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
				) => string
			>().not.toExtend<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>();
		});

		test("should reject a handler that requires a second parameter", () => {
			expectTypeOf<
				(
					context: DeveloperContext<{ a: string }, { b: number }>,
					extra: string,
				) => { c: boolean }
			>().not.toExtend<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>();
		});

		test("should reject an error return where a record is expected", () => {
			expectTypeOf<
				StoreFn<AnyError, { a: string }, { b: number }>
			>().not.toExtend<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>();
		});
	});

	describe("empty store and validator shapes", () => {
		type Empty = NonNullable<unknown>;

		test("should reduce `context.request` to just the raw request", () => {
			expectTypeOf<
				Parameters<
					StoreFn<{ c: boolean }, Empty, Empty>
				>[0]["request"]["raw"]
			>().toEqualTypeOf<Request>();
		});

		test("should type `context.store` as an empty object", () => {
			expectTypeOf<
				Parameters<StoreFn<{ c: boolean }, Empty, Empty>>[0]["store"]
			>().toEqualTypeOf<Empty>();
		});
	});

	describe("AnyStoreFn", () => {
		test("should resolve to `StoreFn<any, any, any>`", () => {
			expectTypeOf<AnyStoreFn>().toEqualTypeOf<StoreFn<any, any, any>>();
		});

		test("should accept any concrete store function as a subtype", () => {
			expectTypeOf<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>().toExtend<AnyStoreFn>();
		});

		test("should accept an error-returning store function", () => {
			expectTypeOf<
				StoreFn<AnyError, { a: string }, { b: number }>
			>().toExtend<AnyStoreFn>();
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>[]
			>().toExtend<AnyStoreFn[]>();
		});
	});
});

describe("Store", () => {
	describe("structure", () => {
		test("should type `handler` as the parametrized store function", () => {
			expectTypeOf<
				Store<{ c: boolean }, { a: string }, { b: number }>["handler"]
			>().toEqualTypeOf<
				StoreFn<{ c: boolean }, { a: string }, { b: number }>
			>();
		});

		test('should fix `type` to the `"STORE"` literal', () => {
			expectTypeOf<
				Store<{ c: boolean }, { a: string }, { b: number }>["type"]
			>().toEqualTypeOf<"STORE">();
		});

		test("should mark both `handler` and `type` as required", () => {
			expectTypeOf<
				RequiredKeys<
					Store<{ c: boolean }, { a: string }, { b: number }>
				>
			>().toEqualTypeOf<"handler" | "type">();
		});
	});

	describe("accepted descriptors", () => {
		test('should accept a handler paired with the `"STORE"` tag', () => {
			expectTypeOf<{
				handler: StoreFn<{ c: boolean }, { a: string }, { b: number }>;
				type: "STORE";
			}>().toExtend<
				Store<{ c: boolean }, { a: string }, { b: number }>
			>();
		});
	});

	describe("rejected descriptors", () => {
		test('should reject a `type` other than `"STORE"`', () => {
			expectTypeOf<{
				handler: StoreFn<{ c: boolean }, { a: string }, { b: number }>;
				type: "GROUP";
			}>().not.toExtend<
				Store<{ c: boolean }, { a: string }, { b: number }>
			>();
		});

		test("should reject a descriptor missing `handler`", () => {
			expectTypeOf<{ type: "STORE" }>().not.toExtend<
				Store<{ c: boolean }, { a: string }, { b: number }>
			>();
		});

		test("should reject a descriptor missing `type`", () => {
			expectTypeOf<{
				handler: StoreFn<{ c: boolean }, { a: string }, { b: number }>;
			}>().not.toExtend<
				Store<{ c: boolean }, { a: string }, { b: number }>
			>();
		});
	});

	describe("AnyStore", () => {
		test("should resolve to `Store<any, any, any>`", () => {
			expectTypeOf<AnyStore>().toEqualTypeOf<Store<any, any, any>>();
		});

		test("should accept any concrete store descriptor as a subtype", () => {
			expectTypeOf<
				Store<{ c: boolean }, { a: string }, { b: number }>
			>().toExtend<AnyStore>();
		});

		test('should keep `type` fixed to `"STORE"`', () => {
			expectTypeOf<AnyStore["type"]>().toEqualTypeOf<"STORE">();
		});

		test("should keep `handler` present", () => {
			expectTypeOf<AnyStore>().toHaveProperty("handler");
		});

		test("should keep `type` present", () => {
			expectTypeOf<AnyStore>().toHaveProperty("type");
		});

		test("should be usable as an array element type", () => {
			expectTypeOf<
				Store<{ c: boolean }, { a: string }, { b: number }>[]
			>().toExtend<AnyStore[]>();
		});
	});
});
