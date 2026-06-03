import { describe, expect, expectTypeOf, test } from "bun:test";

import {
	type AnyError,
	type AnyReply,
	type AnyReplyOptions,
	type AnySuccess,
	type Error,
	type FilterError,
	type FilterSuccess,
	fail,
	type IgnoreError,
	type IgnoreSuccess,
	type MergeErrors,
	type MergeSuccesses,
	ok,
	Reply,
	type ReplyConstructor,
	type ReplyOptions,
	type Success,
	type TransformError,
	type TransformSuccess,
} from "@/core/reply";

describe("Reply", () => {
	describe("construction", () => {
		test("should build an envelope from the provided content, status and discriminant", () => {
			const result = new Reply(
				{ a: "v1" },
				{ status: 200, success: true },
			);

			expect(result).toEqual({
				content: { a: "v1" },
				status: 200,
				success: true,
			});
		});

		test("should store the content reference verbatim", () => {
			const content = { a: "v1" };

			const result = new Reply(content, { status: 200, success: true });

			expect(result.content).toBe(content);
		});

		test("should return a distinct instance on each call", () => {
			const a = new Reply("v1", { status: 200, success: true });
			const b = new Reply("v1", { status: 200, success: true });

			expect(a).not.toBe(b);
		});
	});

	describe("instance shape", () => {
		test("should be an instance of Reply", () => {
			expect(
				new Reply("v1", { status: 200, success: true }),
			).toBeInstanceOf(Reply);
		});

		test("should inherit from Reply.prototype", () => {
			expect(
				Object.getPrototypeOf(
					new Reply("v1", { status: 200, success: true }),
				),
			).toBe(Reply.prototype);
		});

		test("should expose content, status and success as own keys in insertion order", () => {
			const result = new Reply("v1", { status: 200, success: true });

			expect(Reflect.ownKeys(result)).toEqual([
				"content",
				"status",
				"success",
			]);
		});
	});

	describe("constructor metadata", () => {
		test("should expose 'Reply' as the constructor name", () => {
			expect(Reply.name).toBe("Reply");
		});

		test("should declare two required formal parameters", () => {
			expect(Reply.length).toBe(2);
		});
	});

	describe("invocation contract", () => {
		test("should throw a TypeError when called without new", () => {
			const callWithoutNew = Reply as unknown as (
				content: unknown,
				options: { status: number; success: boolean },
			) => void;

			expect(() =>
				callWithoutNew("v1", { status: 200, success: true }),
			).toThrow(TypeError);
		});
	});

	describe("serialization", () => {
		test("should serialize to JSON with content, status and success in order", () => {
			const result = new Reply(
				{ a: "v1" },
				{ status: 200, success: true },
			);

			expect(JSON.stringify(result)).toBe(
				'{"content":{"a":"v1"},"status":200,"success":true}',
			);
		});
	});

	describe("type-level envelope", () => {
		test("should default the status to 200 and the discriminant to true", () => {
			expectTypeOf<Reply<"v1">>().toEqualTypeOf<{
				content: "v1";
				status: 200;
				success: true;
			}>();
		});

		test("should preserve explicit status and discriminant literals", () => {
			expectTypeOf<Reply<"v1", 401, false>>().toEqualTypeOf<{
				content: "v1";
				status: 401;
				success: false;
			}>();
		});

		test("should unwrap a function-typed content to its return type", () => {
			expectTypeOf<Reply<() => "v1">["content"]>().toEqualTypeOf<"v1">();
		});

		test("should await a promise-returning content factory", () => {
			expectTypeOf<
				Reply<() => Promise<"v1">>["content"]
			>().toEqualTypeOf<"v1">();
		});

		test("should expose exactly content, status and success", () => {
			expectTypeOf<keyof Reply<"v1">>().toEqualTypeOf<
				"content" | "status" | "success"
			>();
		});

		test("should reject a non-numeric status at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = Reply<"v1", "200">;
		});

		test("should reject a non-boolean discriminant at compile time", () => {
			// @ts-expect-error - Ok must extend boolean
			type _A = Reply<"v1", 200, "yes">;
		});
	});
});

describe("AnyReply", () => {
	test("should equal Reply with any content, status and discriminant", () => {
		expectTypeOf<AnyReply>().toEqualTypeOf<Reply<any, any, any>>();
	});

	test("should widen the discriminant to any", () => {
		expectTypeOf<AnyReply["success"]>().toBeAny();
	});

	test("should be extended by a concrete success envelope", () => {
		expectTypeOf<Success<"v1", 200>>().toExtend<AnyReply>();
	});

	test("should be extended by a concrete error envelope", () => {
		expectTypeOf<Error<"v1", 400>>().toExtend<AnyReply>();
	});
});

describe("ok", () => {
	describe("construction", () => {
		test("should expose content, the default status 200 and success true from a content-only call", () => {
			const instance = ok("v1");

			expect(instance.content).toBe("v1");
			expect(instance.status).toBe(200);
			expect(instance.success).toBe(true);
		});

		test("should default the status to 200 when options omit a status", () => {
			expect(ok("v1", {}).status).toBe(200);
		});

		test("should use the status provided in options", () => {
			expect(ok("v1", { status: 201 }).status).toBe(201);
		});

		test("should keep success true regardless of the status code", () => {
			expect(ok("v1", { status: 500 }).success).toBe(true);
		});

		test("should keep a falsy status code such as 0 instead of defaulting", () => {
			expect(ok("v1", { status: 0 }).status).toBe(0);
		});

		test("should mark instances as instanceof Reply", () => {
			expect(ok("v1")).toBeInstanceOf(Reply);
		});

		test("should store the content reference verbatim", () => {
			const content = { a: "v1" };

			expect(ok(content).content).toBe(content);
		});
	});

	describe("content value handling", () => {
		test("should store a primitive payload", () => {
			expect(ok(42).content).toBe(42);
		});

		test("should store an array payload", () => {
			expect(ok([1, 2, 3]).content).toEqual([1, 2, 3]);
		});

		test("should store null verbatim", () => {
			expect(ok(null).content).toBeNull();
		});

		test("should store an undefined payload as a present key", () => {
			const result = ok(undefined);

			expect("content" in result).toBe(true);
			expect(result.content).toBeUndefined();
		});

		test("should store a function payload without invoking it", () => {
			const fn = () => "v1";

			expect(ok(fn).content as unknown).toBe(fn);
		});
	});

	describe("return shape", () => {
		test("should own exactly the content, status and success keys", () => {
			expect(Object.keys(ok("v1"))).toEqual([
				"content",
				"status",
				"success",
			]);
		});

		test("should serialize to the three-field envelope", () => {
			expect(JSON.stringify(ok("v1", { status: 201 }))).toBe(
				'{"content":"v1","status":201,"success":true}',
			);
		});
	});

	describe("factory metadata", () => {
		test("should expose 'ok' as the function name", () => {
			expect(ok.name).toBe("ok");
		});

		test("should declare a single required formal parameter", () => {
			expect(ok.length).toBe(1);
		});
	});

	describe("type-level", () => {
		test("should infer content and the default status into a Success envelope", () => {
			expectTypeOf(ok("v1")).toEqualTypeOf<Success<"v1", 200>>();
		});

		test("should thread the options status literal into the result", () => {
			expectTypeOf(ok("v1", { status: 201 })).toEqualTypeOf<
				Success<"v1", 201>
			>();
		});

		test("should infer object content as a readonly literal via the const type parameter", () => {
			expectTypeOf(ok({ a: "v1" }, { status: 201 })).toEqualTypeOf<
				Success<{ readonly a: "v1" }, 201>
			>();
		});

		test("should infer the content type from the argument", () => {
			expectTypeOf(ok("v1").content).toEqualTypeOf<"v1">();
		});

		test("should not widen the status to number", () => {
			expectTypeOf(ok("v1", { status: 503 })).not.toEqualTypeOf<
				Success<"v1", number>
			>();
		});
	});
});

describe("fail", () => {
	describe("construction", () => {
		test("should expose content, the default status 400 and success false from a content-only call", () => {
			const instance = fail("v1");

			expect(instance.content).toBe("v1");
			expect(instance.status).toBe(400);
			expect(instance.success).toBe(false);
		});

		test("should default the status to 400 when options omit a status", () => {
			expect(fail("v1", {}).status).toBe(400);
		});

		test("should use the status provided in options", () => {
			expect(fail("v1", { status: 401 }).status).toBe(401);
		});

		test("should keep success false regardless of the status code", () => {
			expect(fail("v1", { status: 200 }).success).toBe(false);
		});

		test("should keep a falsy status code such as 0 instead of defaulting", () => {
			expect(fail("v1", { status: 0 }).status).toBe(0);
		});

		test("should mark instances as instanceof Reply", () => {
			expect(fail("v1")).toBeInstanceOf(Reply);
		});

		test("should store the content reference verbatim", () => {
			const content = { a: "v1" };

			expect(fail(content).content).toBe(content);
		});
	});

	describe("content value handling", () => {
		test("should store a primitive payload", () => {
			expect(fail(42).content).toBe(42);
		});

		test("should store an array payload", () => {
			expect(fail([1, 2, 3]).content).toEqual([1, 2, 3]);
		});

		test("should store null verbatim", () => {
			expect(fail(null).content).toBeNull();
		});

		test("should store an undefined payload as a present key", () => {
			const result = fail(undefined);

			expect("content" in result).toBe(true);
			expect(result.content).toBeUndefined();
		});

		test("should store a function payload without invoking it", () => {
			const fn = () => "v1";

			expect(fail(fn).content as unknown).toBe(fn);
		});
	});

	describe("return shape", () => {
		test("should own exactly the content, status and success keys", () => {
			expect(Object.keys(fail("v1"))).toEqual([
				"content",
				"status",
				"success",
			]);
		});

		test("should serialize to the three-field envelope", () => {
			expect(JSON.stringify(fail("v1", { status: 401 }))).toBe(
				'{"content":"v1","status":401,"success":false}',
			);
		});
	});

	describe("factory metadata", () => {
		test("should expose 'fail' as the function name", () => {
			expect(fail.name).toBe("fail");
		});

		test("should declare a single required formal parameter", () => {
			expect(fail.length).toBe(1);
		});
	});

	describe("type-level", () => {
		test("should infer content and the default status into an Error envelope", () => {
			expectTypeOf(fail("v1")).toEqualTypeOf<Error<"v1", 400>>();
		});

		test("should thread the options status literal into the result", () => {
			expectTypeOf(fail("v1", { status: 401 })).toEqualTypeOf<
				Error<"v1", 401>
			>();
		});

		test("should infer object content as a readonly literal via the const type parameter", () => {
			expectTypeOf(fail({ a: "v1" }, { status: 401 })).toEqualTypeOf<
				Error<{ readonly a: "v1" }, 401>
			>();
		});

		test("should not widen the status to number", () => {
			expectTypeOf(fail("v1", { status: 503 })).not.toEqualTypeOf<
				Error<"v1", number>
			>();
		});
	});
});

describe("Error", () => {
	describe("type-level envelope", () => {
		test("should default the status to 400 and fix success to false", () => {
			expectTypeOf<Error<"v1">>().toEqualTypeOf<{
				content: "v1";
				status: 400;
				success: false;
			}>();
		});

		test("should preserve a custom status literal", () => {
			expectTypeOf<Error<"v1", 401>["status"]>().toEqualTypeOf<401>();
		});

		test("should not widen the status to number", () => {
			expectTypeOf<
				Error<"v1", 401>["status"]
			>().not.toEqualTypeOf<number>();
		});

		test("should fix success to the literal false", () => {
			expectTypeOf<Error<"v1">["success"]>().toEqualTypeOf<false>();
		});

		test("should unwrap a function-typed content to its return type", () => {
			expectTypeOf<Error<() => "v1">["content"]>().toEqualTypeOf<"v1">();
		});

		test("should expose exactly content, status and success", () => {
			expectTypeOf<keyof Error<"v1">>().toEqualTypeOf<
				"content" | "status" | "success"
			>();
		});

		test("should reject a non-numeric status at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = Error<"v1", "400">;
		});
	});
});

describe("Success", () => {
	describe("type-level envelope", () => {
		test("should default the status to 200 and fix success to true", () => {
			expectTypeOf<Success<"v1">>().toEqualTypeOf<{
				content: "v1";
				status: 200;
				success: true;
			}>();
		});

		test("should preserve a custom status literal", () => {
			expectTypeOf<Success<"v1", 201>["status"]>().toEqualTypeOf<201>();
		});

		test("should fix success to the literal true", () => {
			expectTypeOf<Success<"v1">["success"]>().toEqualTypeOf<true>();
			expectTypeOf<
				Success<"v1">["success"]
			>().not.toEqualTypeOf<boolean>();
		});

		test("should await a promise-returning content factory", () => {
			expectTypeOf<Success<() => Promise<"v1">>>().toEqualTypeOf<{
				content: "v1";
				status: 200;
				success: true;
			}>();
		});

		test("should reject a non-numeric status at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = Success<"v1", "200">;
		});
	});
});

describe("AnyError", () => {
	test("should equal Reply with any content, any status and success false", () => {
		expectTypeOf<AnyError>().toEqualTypeOf<Error<any, any>>();
	});

	test("should match a concrete error envelope", () => {
		expectTypeOf<Error<"v1", 400>>().toExtend<AnyError>();
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

describe("AnySuccess", () => {
	test("should equal Reply with any content, any status and success true", () => {
		expectTypeOf<AnySuccess>().toEqualTypeOf<Success<any, any>>();
	});

	test("should match a concrete success envelope", () => {
		expectTypeOf<Success<"v1", 200>>().toExtend<AnySuccess>();
	});

	test("should fix the success discriminant to true", () => {
		expectTypeOf<AnySuccess["success"]>().toEqualTypeOf<true>();
	});

	test("should not match an error-shaped envelope", () => {
		expectTypeOf<Error<"v1", 400>>().not.toExtend<AnySuccess>();
	});
});

describe("ReplyOptions", () => {
	describe("status field", () => {
		test("should make the status property optional", () => {
			expectTypeOf<ReplyOptions<401>["status"]>().toEqualTypeOf<
				401 | undefined
			>();
		});

		test("should preserve a custom status literal", () => {
			expectTypeOf<ReplyOptions<201>>().toEqualTypeOf<{ status?: 201 }>();
		});

		test("should accept options that omit the status field", () => {
			expectTypeOf<Record<never, never>>().toExtend<ReplyOptions>();
		});
	});

	describe("input constraint", () => {
		test("should reject a non-numeric status parameter at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = ReplyOptions<string>;
		});
	});
});

describe("AnyReplyOptions", () => {
	test("should widen the status to any", () => {
		expectTypeOf<AnyReplyOptions["status"]>().toBeAny();
	});

	test("should accept any numeric status literal", () => {
		expectTypeOf<{ status: 401 }>().toExtend<AnyReplyOptions>();
		expectTypeOf<{ status: 200 }>().toExtend<AnyReplyOptions>();
	});

	test("should accept an empty options object", () => {
		expectTypeOf<Record<never, never>>().toExtend<AnyReplyOptions>();
	});
});

describe("ReplyConstructor", () => {
	test("should be the type of the Reply constructor value", () => {
		expectTypeOf(Reply).toEqualTypeOf<ReplyConstructor>();
	});

	test("should infer content, status and discriminant as literals", () => {
		expectTypeOf(
			new Reply("v1", { status: 401, success: false }),
		).toEqualTypeOf<Reply<"v1", 401, false>>();
	});

	test("should infer object content as a readonly literal via the const type parameter", () => {
		expectTypeOf(
			new Reply({ a: "v1" }, { status: 200, success: true }),
		).toEqualTypeOf<Reply<{ readonly a: "v1" }, 200, true>>();
	});

	test("should not widen the status to number", () => {
		expectTypeOf(
			new Reply("v1", { status: 503, success: true }),
		).not.toEqualTypeOf<Reply<"v1", number, true>>();
	});
});

describe("FilterError", () => {
	describe("isolating error members", () => {
		test("should keep the error member and drop a success member", () => {
			expectTypeOf<
				FilterError<Error<"v1", 400> | Success<"v2", 200>>
			>().toEqualTypeOf<Error<"v1", 400>>();
		});

		test("should drop a primitive member", () => {
			expectTypeOf<
				FilterError<Error<"v1", 400> | string>
			>().toEqualTypeOf<Error<"v1", 400>>();
		});

		test("should keep multiple error members", () => {
			expectTypeOf<
				FilterError<Error<"v1", 400> | Error<"v2", 500> | string>
			>().toEqualTypeOf<Error<"v1", 400> | Error<"v2", 500>>();
		});

		test("should resolve to AnyError when given AnyError", () => {
			expectTypeOf<FilterError<AnyError>>().toEqualTypeOf<AnyError>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never when no member is an error", () => {
			expectTypeOf<FilterError<string | number>>().toBeNever();
		});

		test("should resolve to never for never", () => {
			expectTypeOf<FilterError<never>>().toBeNever();
		});
	});
});

describe("FilterSuccess", () => {
	describe("isolating success members", () => {
		test("should keep the success branch out of a success/error union", () => {
			expectTypeOf<
				FilterSuccess<Success<"v1", 200> | Error<"v2", 400>>
			>().toEqualTypeOf<Success<"v1", 200>>();
		});

		test("should discard members that are not success envelopes", () => {
			expectTypeOf<
				FilterSuccess<Success<"v1", 200> | string | number>
			>().toEqualTypeOf<Success<"v1", 200>>();
		});

		test("should keep every success member of a multi-success union", () => {
			expectTypeOf<
				FilterSuccess<Success<"v1", 200> | Success<"v2", 201> | string>
			>().toEqualTypeOf<Success<"v1", 200> | Success<"v2", 201>>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never when the union holds only errors", () => {
			expectTypeOf<FilterSuccess<Error<"v1", 400>>>().toBeNever();
		});

		test("should resolve to never for a never input", () => {
			expectTypeOf<FilterSuccess<never>>().toBeNever();
		});
	});
});

describe("IgnoreError", () => {
	describe("isolating non-error members", () => {
		test("should drop the error member and keep a success member", () => {
			expectTypeOf<
				IgnoreError<Error<"v1", 400> | Success<"v2", 200>>
			>().toEqualTypeOf<Success<"v2", 200>>();
		});

		test("should keep a primitive member", () => {
			expectTypeOf<
				IgnoreError<Error<"v1", 400> | string>
			>().toEqualTypeOf<string>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never when every member is an error", () => {
			expectTypeOf<
				IgnoreError<Error<"v1", 400> | Error<"v2", 500>>
			>().toBeNever();
		});

		test("should resolve to never for never", () => {
			expectTypeOf<IgnoreError<never>>().toBeNever();
		});
	});
});

describe("IgnoreSuccess", () => {
	describe("dropping success members", () => {
		test("should keep the error branch out of a success/error union", () => {
			expectTypeOf<
				IgnoreSuccess<Success<"v1", 200> | Error<"v2", 400>>
			>().toEqualTypeOf<Error<"v2", 400>>();
		});

		test("should keep every error member of a multi-error union", () => {
			expectTypeOf<
				IgnoreSuccess<
					Error<"v1", 400> | Error<"v2", 500> | Success<"v3", 200>
				>
			>().toEqualTypeOf<Error<"v1", 400> | Error<"v2", 500>>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never when the union holds only successes", () => {
			expectTypeOf<IgnoreSuccess<Success<"v1", 200>>>().toBeNever();
		});

		test("should resolve to never for a never input", () => {
			expectTypeOf<IgnoreSuccess<never>>().toBeNever();
		});
	});
});

describe("TransformError", () => {
	test("should re-key a single error by its status", () => {
		expectTypeOf<TransformError<Error<"v1", 400>>>().branded.toEqualTypeOf<{
			400: Error<"v1", 400>;
		}>();
	});

	test("should re-key an error that relies on the default status", () => {
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
		type _A = TransformError<Success<"v1", 200>>;
	});
});

describe("TransformSuccess", () => {
	test("should re-key a single success by its status", () => {
		expectTypeOf<
			TransformSuccess<Success<"v1", 200>>
		>().branded.toEqualTypeOf<{ 200: Success<"v1", 200> }>();
	});

	test("should re-key a success that relies on the default status", () => {
		expectTypeOf<TransformSuccess<Success<"v1">>>().branded.toEqualTypeOf<{
			200: Success<"v1">;
		}>();
	});

	test("should map every status to the full union without distributing", () => {
		expectTypeOf<
			TransformSuccess<Success<"v1", 200> | Success<"v2", 201>>
		>().branded.toEqualTypeOf<{
			200: Success<"v1", 200> | Success<"v2", 201>;
			201: Success<"v1", 200> | Success<"v2", 201>;
		}>();
	});

	test("should reject a non-success argument at compile time", () => {
		// @ts-expect-error - argument must extend AnySuccess
		type _A = TransformSuccess<Error<"v1", 400>>;
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
		test("should union shared entries and pass first-only and second-only entries through", () => {
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

describe("MergeSuccesses", () => {
	describe("with disjoint statuses", () => {
		test("should take each entry verbatim when the statuses do not overlap", () => {
			expectTypeOf<
				MergeSuccesses<
					{ 200: { content: ["a"] } },
					{ 201: { content: ["b"] } }
				>
			>().branded.toEqualTypeOf<{
				200: { content: ["a"] };
				201: { content: ["b"] };
			}>();
		});
	});

	describe("with a shared status", () => {
		test("should merge the inner values when both operands share a status", () => {
			expectTypeOf<
				MergeSuccesses<
					{ 200: { content: ["a"]; status: 200; success: true } },
					{ 200: { content: ["b"]; status: 200; success: true } }
				>
			>().branded.toEqualTypeOf<{
				200: { content: ["a"] | ["b"]; status: 200; success: true };
			}>();
		});
	});

	describe("idempotence", () => {
		test("should resolve to the same dictionary when merged with itself", () => {
			interface A {
				200: { content: ["a"]; status: 200; success: true };
			}

			expectTypeOf<MergeSuccesses<A, A>>().branded.toEqualTypeOf<A>();
		});
	});
});
