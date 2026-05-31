import { describe, expect, expectTypeOf, test } from "bun:test";

import {
	type AnyError,
	type AnyErrorOptions,
	Error,
	type ErrorConstructor,
	type ErrorOptions,
	type FilterError,
	type IgnoreError,
	type MergeErrors,
	type TransformError,
} from "@/core/error";

describe("Error", () => {
	describe("construction", () => {
		test("should build an envelope with content, the default status 400 and success false", () => {
			const result = new Error({ a: "v1" });

			expect(result).toEqual({
				content: { a: "v1" },
				status: 400,
				success: false,
			});
		});

		test("should use the provided status code", () => {
			const result = new Error({ a: 1 }, { status: 401 });

			expect(result.status).toBe(401);
		});

		test("should always set success to false", () => {
			expect(new Error("v1").success).toBe(false);
			expect(new Error("v1", { status: 401 }).success).toBe(false);
		});

		test("should store the content reference verbatim", () => {
			const content = { a: "v1" };

			const result = new Error(content);

			expect(result.content).toBe(content);
		});

		test("should return a distinct instance on each call", () => {
			const a = new Error("v1");
			const b = new Error("v1");

			expect(a).not.toBe(b);
		});
	});

	describe("default status", () => {
		test("should default to 400 when options are omitted", () => {
			expect(new Error("v1").status).toBe(400);
		});

		test("should default to 400 when an empty options object is passed", () => {
			expect(new Error("v1", {}).status).toBe(400);
		});

		test("should keep a falsy status code such as 0 instead of defaulting", () => {
			expect(new Error("v1", { status: 0 }).status).toBe(0);
		});
	});

	describe("content value handling", () => {
		test("should store a primitive payload", () => {
			expect(new Error("v1").content).toBe("v1");
		});

		test("should store an array payload", () => {
			expect(new Error([1, 2, 3]).content).toEqual([1, 2, 3]);
		});

		test("should store null verbatim", () => {
			expect(new Error(null).content).toBeNull();
		});

		test("should store an undefined payload as a present key", () => {
			const result = new Error(undefined);

			expect("content" in result).toBe(true);
			expect(result.content).toBeUndefined();
		});

		test("should store a function payload without invoking it", () => {
			const fn = () => "v1";

			const result = new Error(fn);

			expect(result.content as unknown).toBe(fn);
		});
	});

	describe("instance shape", () => {
		test("should be an instance of Error", () => {
			expect(new Error("v1")).toBeInstanceOf(Error);
		});

		test("should inherit from Error.prototype", () => {
			expect(Object.getPrototypeOf(new Error("v1"))).toBe(
				Error.prototype,
			);
		});

		test("should expose content, status and success as own keys in insertion order", () => {
			const result = new Error("v1");

			expect(Reflect.ownKeys(result)).toEqual([
				"content",
				"status",
				"success",
			]);
		});
	});

	describe("constructor metadata", () => {
		test("should expose 'Error' as the constructor name", () => {
			expect(Error.name).toBe("Error");
		});

		test("should declare a single required formal parameter", () => {
			expect(Error.length).toBe(1);
		});
	});

	describe("serialization", () => {
		test("should serialize to JSON with content, status and success in order", () => {
			const result = new Error({ a: "v1" });

			expect(JSON.stringify(result)).toBe(
				'{"content":{"a":"v1"},"status":400,"success":false}',
			);
		});
	});

	describe("invocation contract", () => {
		test("should throw a TypeError when called without new", () => {
			const callWithoutNew = Error as unknown as (
				content: unknown,
			) => void;

			expect(() => callWithoutNew("v1")).toThrow(TypeError);
		});
	});

	describe("type-level content extraction", () => {
		test("should pass a non-function content through unchanged", () => {
			expectTypeOf<Error<{ a: "v1" }>["content"]>().toEqualTypeOf<{
				a: "v1";
			}>();
		});

		test("should unwrap a function-typed content to its return type", () => {
			expectTypeOf<Error<() => "v1">["content"]>().toEqualTypeOf<"v1">();
		});

		test("should await a promise-returning content factory", () => {
			expectTypeOf<
				Error<() => Promise<"v1">>["content"]
			>().toEqualTypeOf<"v1">();
		});
	});

	describe("type-level status", () => {
		test("should default the status to 400", () => {
			expectTypeOf<Error<"v1">["status"]>().toEqualTypeOf<400>();
		});

		test("should preserve a custom status literal", () => {
			expectTypeOf<Error<"v1", 401>["status"]>().toEqualTypeOf<401>();
		});

		test("should not widen the status to number", () => {
			expectTypeOf<
				Error<"v1", 401>["status"]
			>().not.toEqualTypeOf<number>();
		});
	});

	describe("type-level discriminant", () => {
		test("should fix success to the literal false", () => {
			expectTypeOf<Error<"v1">["success"]>().toEqualTypeOf<false>();
		});
	});

	describe("type-level shape", () => {
		test("should expose exactly content, status and success", () => {
			expectTypeOf<keyof Error<"v1">>().toEqualTypeOf<
				"content" | "status" | "success"
			>();
		});
	});
});

describe("ErrorOptions", () => {
	describe("status field", () => {
		test("should default the status parameter to 400", () => {
			expectTypeOf<ErrorOptions>().toEqualTypeOf<ErrorOptions<400>>();
		});

		test("should make the status property optional", () => {
			expectTypeOf<ErrorOptions["status"]>().toEqualTypeOf<
				400 | undefined
			>();
		});

		test("should preserve a custom status literal", () => {
			expectTypeOf<ErrorOptions<401>["status"]>().toEqualTypeOf<
				401 | undefined
			>();
		});

		test("should accept options that omit the status field", () => {
			expectTypeOf<Record<never, never>>().toExtend<ErrorOptions>();
		});
	});

	describe("input constraint", () => {
		test("should reject a non-numeric status parameter at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = ErrorOptions<string>;
		});
	});
});

describe("AnyErrorOptions", () => {
	test("should equal ErrorOptions with any status", () => {
		expectTypeOf<AnyErrorOptions>().toEqualTypeOf<ErrorOptions<any>>();
	});

	test("should accept any numeric status literal", () => {
		expectTypeOf<{ status: 401 }>().toExtend<AnyErrorOptions>();
		expectTypeOf<{ status: 200 }>().toExtend<AnyErrorOptions>();
	});

	test("should accept an empty options object", () => {
		expectTypeOf<Record<never, never>>().toExtend<AnyErrorOptions>();
	});
});

describe("AnyError", () => {
	test("should equal Error with any content and any status", () => {
		expectTypeOf<AnyError>().toEqualTypeOf<Error<any, any>>();
	});

	test("should match a concrete Error envelope", () => {
		expectTypeOf<Error<"v1", 400>>().toExtend<AnyError>();
	});

	test("should match an Error carrying a different status", () => {
		expectTypeOf<Error<"v2", 500>>().toExtend<AnyError>();
	});

	test("should fix the success discriminant to false", () => {
		expectTypeOf<AnyError["success"]>().toEqualTypeOf<false>();
	});

	test("should not match a success-shaped envelope", () => {
		expectTypeOf<{
			content: "v1";
			status: 200;
			success: true;
		}>().not.toExtend<AnyError>();
	});
});

describe("ErrorConstructor", () => {
	test("should be the type of the Error constructor value", () => {
		expectTypeOf(Error).toEqualTypeOf<ErrorConstructor>();
	});

	test("should infer the content and status as literals", () => {
		expectTypeOf(new Error("v1", { status: 401 })).toEqualTypeOf<
			Error<"v1", 401>
		>();
	});

	test("should default the status to 400 when options are omitted", () => {
		expectTypeOf(new Error("v1")).toEqualTypeOf<Error<"v1", 400>>();
	});

	test("should infer object content as a readonly literal via the const type parameter", () => {
		expectTypeOf(new Error({ a: "v1" }, { status: 401 })).toEqualTypeOf<
			Error<{ readonly a: "v1" }, 401>
		>();
	});

	test("should not widen the status to number", () => {
		expectTypeOf(new Error("v1", { status: 503 })).not.toEqualTypeOf<
			Error<"v1", number>
		>();
	});
});

describe("FilterError", () => {
	describe("isolating error members", () => {
		test("should keep the Error member and drop a non-error member", () => {
			expectTypeOf<
				FilterError<
					| Error<"v1", 400>
					| { content: "v2"; status: 200; success: true }
				>
			>().toEqualTypeOf<Error<"v1", 400>>();
		});

		test("should drop a primitive member", () => {
			expectTypeOf<
				FilterError<Error<"v1", 400> | string>
			>().toEqualTypeOf<Error<"v1", 400>>();
		});

		test("should keep multiple Error members", () => {
			expectTypeOf<
				FilterError<Error<"v1", 400> | Error<"v2", 500> | string>
			>().toEqualTypeOf<Error<"v1", 400> | Error<"v2", 500>>();
		});

		test("should preserve a sole Error member", () => {
			expectTypeOf<FilterError<Error<"v1", 400>>>().toEqualTypeOf<
				Error<"v1", 400>
			>();
		});

		test("should resolve to AnyError when given AnyError", () => {
			expectTypeOf<FilterError<AnyError>>().toEqualTypeOf<AnyError>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never when no member is an Error", () => {
			expectTypeOf<FilterError<string | number>>().toBeNever();
		});

		test("should resolve to never for never", () => {
			expectTypeOf<FilterError<never>>().toBeNever();
		});
	});
});

describe("IgnoreError", () => {
	describe("isolating non-error members", () => {
		test("should drop the Error member and keep a non-error member", () => {
			expectTypeOf<
				IgnoreError<
					| Error<"v1", 400>
					| { content: "v2"; status: 200; success: true }
				>
			>().toEqualTypeOf<{ content: "v2"; status: 200; success: true }>();
		});

		test("should keep a primitive member", () => {
			expectTypeOf<
				IgnoreError<Error<"v1", 400> | string>
			>().toEqualTypeOf<string>();
		});

		test("should keep multiple non-error members", () => {
			expectTypeOf<
				IgnoreError<Error<"v1", 400> | string | number>
			>().toEqualTypeOf<string | number>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never when every member is an Error", () => {
			expectTypeOf<
				IgnoreError<Error<"v1", 400> | Error<"v2", 500>>
			>().toBeNever();
		});

		test("should resolve to never for never", () => {
			expectTypeOf<IgnoreError<never>>().toBeNever();
		});
	});
});

describe("TransformError", () => {
	test("should re-key a single Error by its status", () => {
		expectTypeOf<TransformError<Error<"v1", 400>>>().branded.toEqualTypeOf<{
			400: Error<"v1", 400>;
		}>();
	});

	test("should key by a different status literal", () => {
		expectTypeOf<TransformError<Error<"v2", 500>>>().branded.toEqualTypeOf<{
			500: Error<"v2", 500>;
		}>();
	});

	test("should re-key an Error that relies on the default status", () => {
		expectTypeOf<TransformError<Error<"v1">>>().branded.toEqualTypeOf<{
			400: Error<"v1">;
		}>();
	});

	test("should keep the narrow status literal as the key, not widen to number", () => {
		expectTypeOf<
			keyof TransformError<Error<"v1", 400>>
		>().toEqualTypeOf<400>();
	});

	test("should reject a non-error argument at compile time", () => {
		// @ts-expect-error - argument must extend AnyError
		type _A = TransformError<{ content: "v1"; status: 200; success: true }>;
	});
});

describe("MergeErrors", () => {
	describe("with disjoint statuses", () => {
		test("should keep entries present only in one operand", () => {
			expectTypeOf<
				MergeErrors<
					{ 400: { content: "v1"; status: 400; success: false } },
					{ 500: { content: "v2"; status: 500; success: false } }
				>
			>().branded.toEqualTypeOf<{
				400: { content: "v1"; status: 400; success: false };
				500: { content: "v2"; status: 500; success: false };
			}>();
		});
	});

	describe("with a shared status", () => {
		test("should union differing inner value types under a shared status", () => {
			expectTypeOf<
				MergeErrors<
					{ 400: { content: ["a"]; status: 400; success: false } },
					{ 400: { content: ["b"]; status: 400; success: false } }
				>
			>().branded.toEqualTypeOf<{
				400: { content: ["a"] | ["b"]; status: 400; success: false };
			}>();
		});

		test("should keep inner keys exclusive to one side", () => {
			expectTypeOf<
				MergeErrors<{ 400: { a: 1 } }, { 400: { b: 2 } }>
			>().branded.toEqualTypeOf<{ 400: { a: 1; b: 2 } }>();
		});
	});

	describe("with shared and disjoint statuses combined", () => {
		test("should mix unioned, first-only and second-only entries", () => {
			expectTypeOf<
				MergeErrors<
					{ 400: { a: 1 }; 500: { b: 2 } },
					{ 400: { a: 2 }; 600: { c: 3 } }
				>
			>().branded.toEqualTypeOf<{
				400: { a: 1 | 2 };
				500: { b: 2 };
				600: { c: 3 };
			}>();
		});
	});

	describe("idempotence", () => {
		test("should resolve to the same dictionary when merged with itself", () => {
			interface A {
				400: { content: "v1"; status: 400; success: false };
			}

			expectTypeOf<MergeErrors<A, A>>().branded.toEqualTypeOf<A>();
		});
	});

	describe("input constraint", () => {
		test("should reject a non-object operand at compile time", () => {
			// @ts-expect-error - operands must extend object
			type _A = MergeErrors<{ 400: { content: "v1" } }, number>;
		});
	});
});
