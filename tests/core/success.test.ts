import { beforeAll, describe, expect, expectTypeOf, test } from "bun:test";

import type { Error } from "@/core/error";
import {
	type AnySuccess,
	type AnySuccessOptions,
	type FilterSuccess,
	type IgnoreSuccess,
	type MergeSuccesses,
	Success,
	type SuccessConstructor,
	type SuccessOptions,
	type TransformSuccess,
} from "@/core/success";

describe("FilterSuccess", () => {
	describe("filtering success members", () => {
		test("should keep the success branch out of a success/error union", () => {
			expectTypeOf<
				FilterSuccess<Success<"v1", 200> | Error<"v2", 400>>
			>().toEqualTypeOf<Success<"v1", 200>>();
		});

		test("should keep every success member of a multi-success union", () => {
			expectTypeOf<
				FilterSuccess<Success<"v1", 200> | Success<"v2", 201>>
			>().toEqualTypeOf<Success<"v1", 200> | Success<"v2", 201>>();
		});
	});

	describe("non-success members", () => {
		test("should resolve to never when the union holds only errors", () => {
			expectTypeOf<FilterSuccess<Error<"v1", 400>>>().toBeNever();
		});

		test("should discard members that are not success envelopes", () => {
			expectTypeOf<
				FilterSuccess<Success<"v1", 200> | string | number>
			>().toEqualTypeOf<Success<"v1", 200>>();
		});
	});

	describe("degenerate inputs", () => {
		test("should resolve to never for a never input", () => {
			expectTypeOf<FilterSuccess<never>>().toBeNever();
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

		test("should resolve to never when the union holds only successes", () => {
			expectTypeOf<IgnoreSuccess<Success<"v1", 200>>>().toBeNever();
		});
	});

	describe("non-success members preserved", () => {
		test("should keep members that are not success envelopes", () => {
			expectTypeOf<
				IgnoreSuccess<Success<"v1", 200> | string>
			>().toEqualTypeOf<string>();
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
		test("should resolve to never for a never input", () => {
			expectTypeOf<IgnoreSuccess<never>>().toBeNever();
		});
	});
});

describe("TransformSuccess", () => {
	describe("single envelope", () => {
		test("should re-key a success envelope by its status code", () => {
			expectTypeOf<TransformSuccess<Success<"v1", 200>>>().toEqualTypeOf<{
				200: Success<"v1", 200>;
			}>();
		});

		test("should re-key by an explicit non-default status", () => {
			expectTypeOf<TransformSuccess<Success<"v1", 201>>>().toEqualTypeOf<{
				201: Success<"v1", 201>;
			}>();
		});

		test("should re-key by the defaulted 200 status", () => {
			expectTypeOf<TransformSuccess<Success<"v1">>>().toEqualTypeOf<{
				200: Success<"v1", 200>;
			}>();
		});
	});

	describe("union input", () => {
		test("should map every status to the full union without distributing", () => {
			expectTypeOf<
				TransformSuccess<Success<"v1", 200> | Success<"v2", 201>>
			>().toEqualTypeOf<{
				200: Success<"v1", 200> | Success<"v2", 201>;
				201: Success<"v1", 200> | Success<"v2", 201>;
			}>();
		});
	});
});

describe("MergeSuccesses", () => {
	describe("disjoint statuses", () => {
		test("should take each entry verbatim when the statuses do not overlap", () => {
			interface A {
				200: { content: ["a"] };
			}
			interface B {
				201: { content: ["b"] };
			}

			expectTypeOf<MergeSuccesses<A, B>>().branded.toEqualTypeOf<{
				200: { content: ["a"] };
				201: { content: ["b"] };
			}>();
		});
	});

	describe("shared statuses", () => {
		test("should merge the inner values when both operands share a status", () => {
			interface A {
				200: { content: ["a"]; status: 200; success: true };
			}
			interface B {
				200: { content: ["b"]; status: 200; success: true };
			}

			expectTypeOf<MergeSuccesses<A, B>>().branded.toEqualTypeOf<{
				200: { content: ["a"] | ["b"]; status: 200; success: true };
			}>();
		});

		test("should union shared inner keys and pass exclusive inner keys through", () => {
			interface A {
				200: { a: 1; shared: "x" };
			}
			interface B {
				200: { b: 2; shared: "y" };
			}

			expectTypeOf<MergeSuccesses<A, B>>().branded.toEqualTypeOf<{
				200: { a: 1; b: 2; shared: "x" | "y" };
			}>();
		});
	});

	describe("mixed statuses", () => {
		test("should combine shared, first-only and second-only statuses", () => {
			interface A {
				200: { content: ["a"] };
				400: { content: ["x"] };
			}
			interface B {
				200: { content: ["b"] };
				201: { content: ["c"] };
			}

			expectTypeOf<MergeSuccesses<A, B>>().branded.toEqualTypeOf<{
				200: { content: ["a"] | ["b"] };
				201: { content: ["c"] };
				400: { content: ["x"] };
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

describe("SuccessOptions", () => {
	describe("status parameter", () => {
		test("should default the status to 200 when no parameter is supplied", () => {
			expectTypeOf<SuccessOptions>().toEqualTypeOf<{ status?: 200 }>();
		});

		test("should preserve an explicit status literal", () => {
			expectTypeOf<SuccessOptions<201>>().toEqualTypeOf<{
				status?: 201;
			}>();
		});
	});

	describe("optional modifier", () => {
		test("should mark status as optional so an empty object is assignable", () => {
			expectTypeOf<NonNullable<unknown>>().toExtend<SuccessOptions>();
		});
	});

	describe("input constraint", () => {
		test("should reject a non-numeric status at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = SuccessOptions<"200">;
		});
	});
});

describe("AnySuccessOptions", () => {
	test("should widen the status to any", () => {
		expectTypeOf<AnySuccessOptions["status"]>().toBeAny();
	});

	test("should be extended by options carrying a concrete status literal", () => {
		expectTypeOf<SuccessOptions<201>>().toExtend<AnySuccessOptions>();
	});

	test("should not be exactly equal to the default SuccessOptions", () => {
		expectTypeOf<AnySuccessOptions>().not.toEqualTypeOf<
			SuccessOptions<200>
		>();
	});
});

describe("Success", () => {
	describe("construction", () => {
		test("should expose content, status and success from a content-only call", () => {
			const instance = new Success("v1");

			expect(instance.content).toBe("v1");
			expect(instance.status).toBe(200);
			expect(instance.success).toBe(true);
		});

		test("should default the status to 200 when options omit a status", () => {
			const instance = new Success("v1", {});

			expect(instance.status).toBe(200);
		});

		test("should use the status provided in options", () => {
			const instance = new Success("v1", { status: 201 });

			expect(instance.status).toBe(201);
		});

		test("should keep success true regardless of the status code", () => {
			const instance = new Success("v1", { status: 500 });

			expect(instance.success).toBe(true);
		});

		test("should mark instances as instanceof Success", () => {
			expect(new Success("v1")).toBeInstanceOf(Success);
		});
	});

	describe("with content 'v1' and options { status: 201 }", () => {
		let instance: AnySuccess;

		beforeAll(() => {
			instance = new Success("v1", { status: 201 });
		});

		test("should assign the content verbatim", () => {
			expect(instance.content).toBe("v1");
		});

		test("should assign the provided status", () => {
			expect(instance.status).toBe(201);
		});

		test("should flag the envelope as successful", () => {
			expect(instance.success).toBe(true);
		});
	});

	describe("content handling", () => {
		test("should store an object payload by reference", () => {
			const content = { a: "v1" };

			const instance: AnySuccess = new Success(content);

			expect(instance.content).toBe(content);
		});

		test("should store a function payload verbatim without invoking it", () => {
			const content = () => "v1";

			const instance: AnySuccess = new Success(content);

			expect(instance.content).toBe(content);
		});

		test("should store an array payload by reference", () => {
			const content = ["a", "b"];

			const instance: AnySuccess = new Success(content);

			expect(instance.content).toBe(content);
		});

		test("should store a null payload", () => {
			const instance: AnySuccess = new Success(null);

			expect(instance.content).toBeNull();
		});

		test("should store an undefined payload", () => {
			const instance: AnySuccess = new Success(undefined);

			expect(instance.content).toBeUndefined();
		});

		test("should store a primitive payload", () => {
			const instance = new Success(42);

			expect(instance.content).toBe(42);
		});
	});

	describe("return shape", () => {
		test("should own exactly the content, status and success keys", () => {
			const instance = new Success("v1");

			expect(Object.keys(instance)).toEqual([
				"content",
				"status",
				"success",
			]);
		});

		test("should serialize to the three-field envelope", () => {
			const instance = new Success("v1", { status: 201 });

			expect(JSON.stringify(instance)).toBe(
				'{"content":"v1","status":201,"success":true}',
			);
		});
	});

	describe("constructor metadata", () => {
		test("should expose 'Success' as the constructor name", () => {
			expect(Success.name).toBe("Success");
		});

		test("should declare one formal parameter before the defaulted options", () => {
			expect(Success.length).toBe(1);
		});
	});

	describe("type-level envelope", () => {
		test("should default the Status parameter to 200", () => {
			expectTypeOf<Success<"v1">>().toEqualTypeOf<{
				content: "v1";
				status: 200;
				success: true;
			}>();
		});

		test("should preserve an explicit status literal", () => {
			expectTypeOf<Success<"v1", 201>>().toEqualTypeOf<{
				content: "v1";
				status: 201;
				success: true;
			}>();
		});

		test("should pass a plain content payload through unchanged", () => {
			expectTypeOf<Success<{ a: "v1" }>["content"]>().toEqualTypeOf<{
				a: "v1";
			}>();
		});

		test("should unwrap a function content to its return type", () => {
			expectTypeOf<Success<() => "v1">>().toEqualTypeOf<{
				content: "v1";
				status: 200;
				success: true;
			}>();
		});

		test("should await a promise-returning content factory", () => {
			expectTypeOf<Success<() => Promise<"v1">>>().toEqualTypeOf<{
				content: "v1";
				status: 200;
				success: true;
			}>();
		});

		test("should type success as the literal true rather than boolean", () => {
			expectTypeOf<Success<"v1">["success"]>().toEqualTypeOf<true>();
			expectTypeOf<
				Success<"v1">["success"]
			>().not.toEqualTypeOf<boolean>();
		});

		test("should reject a non-numeric status at compile time", () => {
			// @ts-expect-error - Status must extend number
			type _A = Success<"v1", "200">;
		});
	});
});

describe("AnySuccess", () => {
	describe("shape", () => {
		test("should type success as the literal true", () => {
			expectTypeOf<AnySuccess["success"]>().toEqualTypeOf<true>();
		});

		test("should widen content to any", () => {
			expectTypeOf<AnySuccess["content"]>().toBeAny();
		});

		test("should widen status to any", () => {
			expectTypeOf<AnySuccess["status"]>().toBeAny();
		});
	});

	describe("subtype relations", () => {
		test("should be extended by a concrete success envelope", () => {
			expectTypeOf<Success<"v1", 200>>().toExtend<AnySuccess>();
		});

		test("should be extended by a success envelope with arbitrary content and status", () => {
			expectTypeOf<Success<{ a: 1 }, 204>>().toExtend<AnySuccess>();
		});
	});

	describe("non-matching shapes", () => {
		test("should not be extended by an error envelope", () => {
			expectTypeOf<Error<"v1", 400>>().not.toExtend<AnySuccess>();
		});

		test("should not be extended by an object lacking the success discriminant", () => {
			expectTypeOf<{
				content: "v1";
				status: 200;
			}>().not.toExtend<AnySuccess>();
		});

		test("should not be extended by an object whose success is false", () => {
			expectTypeOf<{
				content: "v1";
				status: 200;
				success: false;
			}>().not.toExtend<AnySuccess>();
		});
	});
});

describe("SuccessConstructor", () => {
	test("should describe the type of the exported Success value", () => {
		expectTypeOf(Success).toEqualTypeOf<SuccessConstructor>();
	});

	test("should construct a Success with the default 200 status from content alone", () => {
		expectTypeOf(new Success("v1")).toEqualTypeOf<Success<"v1", 200>>();
	});

	test("should thread the options status literal into the result", () => {
		expectTypeOf(new Success("v1", { status: 201 })).toEqualTypeOf<
			Success<"v1", 201>
		>();
	});

	test("should infer the content type from the constructor argument", () => {
		expectTypeOf(new Success("v1").content).toEqualTypeOf<"v1">();
	});
});
