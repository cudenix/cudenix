import { describe, expectTypeOf, test } from "bun:test";

import type { AnyError, Error } from "@/core/error";
import type { AnySuccess, Success } from "@/core/success";
import type { AnyGeneratorSSE, GeneratorSSE } from "@/types/generator-sse";
import type { RequiredKeys } from "@/types/required-keys";

describe("GeneratorSSE", () => {
	describe("minimal frame", () => {
		test("should accept a frame whose `data` is an `AnySuccess`", () => {
			expectTypeOf<{ data: AnySuccess }>().toExtend<
				GeneratorSSE<AnySuccess>
			>();
		});

		test("should accept a frame whose `data` is an `AnyError`", () => {
			expectTypeOf<{ data: AnyError }>().toExtend<
				GeneratorSSE<AnyError>
			>();
		});
	});

	describe("`data` payload typing", () => {
		test("should accept a frame parametrized with a concrete `Success` envelope", () => {
			expectTypeOf<{ data: Success<{ ok: true }, 200> }>().toExtend<
				GeneratorSSE<Success<{ ok: true }, 200>>
			>();
		});

		test("should accept a frame parametrized with a concrete `Error` envelope", () => {
			expectTypeOf<{ data: Error<{ reason: "bad" }, 400> }>().toExtend<
				GeneratorSSE<Error<{ reason: "bad" }, 400>>
			>();
		});

		test("should type `data` as the parametrized payload", () => {
			type Frame = GeneratorSSE<Success<{ ok: true }, 200>>;

			expectTypeOf<Frame["data"]>().toEqualTypeOf<
				Success<{ ok: true }, 200>
			>();
		});
	});

	describe("`event` channel parameter", () => {
		test('should default the channel literal to `"message"`', () => {
			type Default = GeneratorSSE<AnySuccess>;
			type Explicit = GeneratorSSE<AnySuccess, "message">;

			expectTypeOf<Default>().toEqualTypeOf<Explicit>();
		});

		describe("with channel literal 'tick'", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			test("should narrow `event` to the channel literal plus `undefined`", () => {
				expectTypeOf<Frame["event"]>().toEqualTypeOf<
					"tick" | undefined
				>();
			});

			test("should accept a frame whose `event` matches the channel literal", () => {
				expectTypeOf<{
					data: AnySuccess;
					event: "tick";
				}>().toExtend<Frame>();
			});

			test("should reject an `event` value outside the channel literal", () => {
				expectTypeOf<{
					data: AnySuccess;
					event: "other";
				}>().not.toExtend<Frame>();
			});
		});

		describe("with channel union 'a' | 'b'", () => {
			type Frame = GeneratorSSE<AnySuccess, "a" | "b">;

			test("should accept the 'a' member as `event`", () => {
				expectTypeOf<{
					data: AnySuccess;
					event: "a";
				}>().toExtend<Frame>();
			});

			test("should accept the 'b' member as `event`", () => {
				expectTypeOf<{
					data: AnySuccess;
					event: "b";
				}>().toExtend<Frame>();
			});
		});

		test("should accept any string when the channel is widened to `string`", () => {
			type Frame = GeneratorSSE<AnySuccess, string>;

			expectTypeOf<{
				data: AnySuccess;
				event: "arbitrary-name";
			}>().toExtend<Frame>();
		});
	});

	describe("`id` optional field", () => {
		type Frame = GeneratorSSE<AnySuccess>;

		test("should not require `id` to be present", () => {
			expectTypeOf<{ data: AnySuccess }>().toExtend<Frame>();
		});

		test("should type `id` as `string | undefined`", () => {
			expectTypeOf<Frame["id"]>().toEqualTypeOf<string | undefined>();
		});
	});

	describe("`retry` optional field", () => {
		type Frame = GeneratorSSE<AnySuccess>;

		test("should not require `retry` to be present", () => {
			expectTypeOf<{ data: AnySuccess }>().toExtend<Frame>();
		});

		test("should type `retry` as `number | undefined`", () => {
			expectTypeOf<Frame["retry"]>().toEqualTypeOf<number | undefined>();
		});
	});

	describe("required keys contract", () => {
		test("should mark only `data` as required on the parametrized form", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			expectTypeOf<RequiredKeys<Frame>>().toEqualTypeOf<"data">();
		});
	});

	describe("complete frame with every optional field", () => {
		test("should accept a frame populating every optional field", () => {
			type Frame = GeneratorSSE<AnySuccess, "tick">;

			expectTypeOf<{
				data: AnySuccess;
				event: "tick";
				id: string;
				retry: number;
			}>().toExtend<Frame>();
		});
	});

	describe("AnyGeneratorSSE", () => {
		test("should keep `data` required even on the relaxed alias", () => {
			expectTypeOf<AnyGeneratorSSE>().toHaveProperty("data");
		});

		test("should accept a frame whose `data` is `AnyError`", () => {
			expectTypeOf<{ data: AnyError }>().toExtend<AnyGeneratorSSE>();
		});

		test("should accept any string for the `event` channel", () => {
			expectTypeOf<{
				data: AnySuccess;
				event: "anything";
			}>().toExtend<AnyGeneratorSSE>();
		});

		test("should accept any concrete `GeneratorSSE<X, Y>` as a subtype", () => {
			type Frame = GeneratorSSE<Success<{ ok: true }, 200>, "tick">;

			expectTypeOf<Frame>().toExtend<AnyGeneratorSSE>();
		});

		test("should accept a `Success` subtype through `data` covariance", () => {
			type Specific = GeneratorSSE<Success<{ ok: true }, 200>>;
			type Generic = GeneratorSSE<AnySuccess>;

			expectTypeOf<Specific>().toExtend<Generic>();
		});
	});
});
