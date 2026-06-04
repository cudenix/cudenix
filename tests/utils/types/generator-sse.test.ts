import { describe, expectTypeOf, test } from "bun:test";

import type { AnyFail, AnyOk, Fail, Ok } from "@/core/reply";
import type {
	AnyGeneratorSSE,
	GeneratorSSE,
} from "@/utils/types/generator-sse";
import type { RequiredKeys } from "@/utils/types/required-keys";

describe("GeneratorSSE", () => {
	describe("minimal frame", () => {
		test("should accept a frame whose `data` is an `AnyOk`", () => {
			expectTypeOf<{ data: AnyOk }>().toExtend<GeneratorSSE<AnyOk>>();
		});

		test("should accept a frame whose `data` is an `AnyFail`", () => {
			expectTypeOf<{ data: AnyFail }>().toExtend<GeneratorSSE<AnyFail>>();
		});
	});

	describe("`data` payload typing", () => {
		test("should accept a frame parametrized with a concrete `Ok` envelope", () => {
			expectTypeOf<{ data: Ok<{ a: true }, 1> }>().toExtend<
				GeneratorSSE<Ok<{ a: true }, 1>>
			>();
		});

		test("should accept a frame parametrized with a concrete `Fail` envelope", () => {
			expectTypeOf<{ data: Fail<{ a: "v1" }, 1> }>().toExtend<
				GeneratorSSE<Fail<{ a: "v1" }, 1>>
			>();
		});

		test("should type `data` as the parametrized payload", () => {
			type A = GeneratorSSE<Ok<{ a: true }, 1>>;

			expectTypeOf<A["data"]>().toEqualTypeOf<Ok<{ a: true }, 1>>();
		});
	});

	describe("`event` channel parameter", () => {
		test('should default the channel literal to `"message"`', () => {
			type A = GeneratorSSE<AnyOk>;
			type B = GeneratorSSE<AnyOk, "message">;

			expectTypeOf<A>().toEqualTypeOf<B>();
		});

		describe("with channel literal 'tick'", () => {
			type A = GeneratorSSE<AnyOk, "tick">;

			test("should narrow `event` to the channel literal plus `undefined`", () => {
				expectTypeOf<A["event"]>().toEqualTypeOf<"tick" | undefined>();
			});

			test("should accept a frame whose `event` matches the channel literal", () => {
				expectTypeOf<{ data: AnyOk; event: "tick" }>().toExtend<A>();
			});

			test("should reject an `event` value outside the channel literal", () => {
				expectTypeOf<{ data: AnyOk; event: "v1" }>().not.toExtend<A>();
			});
		});

		describe("with channel union 'a' | 'b'", () => {
			type A = GeneratorSSE<AnyOk, "a" | "b">;

			test("should accept the 'a' member as `event`", () => {
				expectTypeOf<{ data: AnyOk; event: "a" }>().toExtend<A>();
			});

			test("should accept the 'b' member as `event`", () => {
				expectTypeOf<{ data: AnyOk; event: "b" }>().toExtend<A>();
			});
		});

		test("should accept any string when the channel is widened to `string`", () => {
			type A = GeneratorSSE<AnyOk, string>;

			expectTypeOf<{ data: AnyOk; event: "v1" }>().toExtend<A>();
		});
	});

	describe("`id` optional field", () => {
		type A = GeneratorSSE<AnyOk>;

		test("should not require `id` to be present", () => {
			expectTypeOf<{ data: AnyOk }>().toExtend<A>();
		});

		test("should type `id` as `string | undefined`", () => {
			expectTypeOf<A["id"]>().toEqualTypeOf<string | undefined>();
		});
	});

	describe("`retry` optional field", () => {
		type A = GeneratorSSE<AnyOk>;

		test("should not require `retry` to be present", () => {
			expectTypeOf<{ data: AnyOk }>().toExtend<A>();
		});

		test("should type `retry` as `number | undefined`", () => {
			expectTypeOf<A["retry"]>().toEqualTypeOf<number | undefined>();
		});
	});

	describe("required keys contract", () => {
		test("should mark only `data` as required on the parametrized form", () => {
			type A = GeneratorSSE<AnyOk, "tick">;

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"data">();
		});
	});

	describe("complete frame with every optional field", () => {
		test("should accept a frame populating every optional field", () => {
			type A = GeneratorSSE<AnyOk, "tick">;

			expectTypeOf<{
				data: AnyOk;
				event: "tick";
				id: string;
				retry: number;
			}>().toExtend<A>();
		});
	});

	describe("AnyGeneratorSSE", () => {
		test("should keep `data` required even on the relaxed alias", () => {
			expectTypeOf<AnyGeneratorSSE>().toHaveProperty("data");
		});

		test("should accept a frame whose `data` is `AnyFail`", () => {
			expectTypeOf<{ data: AnyFail }>().toExtend<AnyGeneratorSSE>();
		});

		test("should accept any string for the `event` channel", () => {
			expectTypeOf<{
				data: AnyOk;
				event: "v1";
			}>().toExtend<AnyGeneratorSSE>();
		});

		test("should accept any concrete `GeneratorSSE<X, Y>` as a subtype", () => {
			type A = GeneratorSSE<Ok<{ a: true }, 1>, "tick">;

			expectTypeOf<A>().toExtend<AnyGeneratorSSE>();
		});

		test("should accept an `Ok` subtype through `data` covariance", () => {
			type A = GeneratorSSE<Ok<{ a: true }, 1>>;
			type B = GeneratorSSE<AnyOk>;

			expectTypeOf<A>().toExtend<B>();
		});
	});
});
