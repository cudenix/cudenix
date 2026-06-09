import { describe, expectTypeOf, it } from "bun:test";

import type { AnyFail, AnyOk, Fail, Ok } from "@/core/reply";
import type {
	AnyGeneratorSSE,
	GeneratorSSE,
} from "@/utils/types/generator-sse";
import type { RequiredKeys } from "@/utils/types/required-keys";

describe("GeneratorSSE", () => {
	describe("minimal frame", () => {
		it("should accept a frame whose `data` is an `AnyOk`", () => {
			expectTypeOf<{ data: AnyOk }>().toExtend<GeneratorSSE<AnyOk>>();
		});

		it("should accept a frame whose `data` is an `AnyFail`", () => {
			expectTypeOf<{ data: AnyFail }>().toExtend<GeneratorSSE<AnyFail>>();
		});

		it("should reject a frame that omits `data`", () => {
			expectTypeOf<{ event: "tick" }>().not.toExtend<
				GeneratorSSE<AnyOk, "tick">
			>();
		});
	});

	describe("`data` payload typing", () => {
		it("should accept a frame parametrized with a concrete `Ok` envelope", () => {
			expectTypeOf<{ data: Ok<{ a: true }, 1> }>().toExtend<
				GeneratorSSE<Ok<{ a: true }, 1>>
			>();
		});

		it("should accept a frame parametrized with a concrete `Fail` envelope", () => {
			expectTypeOf<{ data: Fail<{ a: "v1" }, 1> }>().toExtend<
				GeneratorSSE<Fail<{ a: "v1" }, 1>>
			>();
		});

		it("should type `data` as the parametrized payload", () => {
			type A = GeneratorSSE<Ok<{ a: true }, 1>>;

			expectTypeOf<A["data"]>().toEqualTypeOf<Ok<{ a: true }, 1>>();
		});

		it("should type `data` as the parametrized `Fail` payload", () => {
			type A = GeneratorSSE<Fail<{ a: "v1" }, 1>>;

			expectTypeOf<A["data"]>().toEqualTypeOf<Fail<{ a: "v1" }, 1>>();
		});
	});

	describe("rejected inputs", () => {
		it("should reject a `data` payload that is not a `Reply`", () => {
			// @ts-expect-error - `string` does not satisfy `AnyFail | AnyOk`
			type _A = GeneratorSSE<string>;
		});
	});

	describe("`data` covariance", () => {
		it("should accept an `Ok` subtype through `data` covariance", () => {
			type A = GeneratorSSE<Ok<{ a: true }, 1>>;
			type B = GeneratorSSE<AnyOk>;

			expectTypeOf<A>().toExtend<B>();
		});
	});

	describe("`event` channel parameter", () => {
		test('should default the channel literal to `"message"`', () => {
			type A = GeneratorSSE<AnyOk>;
			type B = GeneratorSSE<AnyOk, "message">;

			expectTypeOf<A>().toEqualTypeOf<B>();
		});

		test('should type `event` as `"message" | undefined` by default', () => {
			type A = GeneratorSSE<AnyOk>;

			expectTypeOf<A["event"]>().toEqualTypeOf<"message" | undefined>();
		});

		describe("with channel literal 'tick'", () => {
			type A = GeneratorSSE<AnyOk, "tick">;

			it("should narrow `event` to the channel literal plus `undefined`", () => {
				expectTypeOf<A["event"]>().toEqualTypeOf<"tick" | undefined>();
			});

			it("should accept a frame whose `event` matches the channel literal", () => {
				expectTypeOf<{ data: AnyOk; event: "tick" }>().toExtend<A>();
			});

			it("should reject an `event` value outside the channel literal", () => {
				expectTypeOf<{ data: AnyOk; event: "v1" }>().not.toExtend<A>();
			});
		});

		describe("with channel union 'a' | 'b'", () => {
			type A = GeneratorSSE<AnyOk, "a" | "b">;

			it("should accept the 'a' member as `event`", () => {
				expectTypeOf<{ data: AnyOk; event: "a" }>().toExtend<A>();
			});

			it("should accept the 'b' member as `event`", () => {
				expectTypeOf<{ data: AnyOk; event: "b" }>().toExtend<A>();
			});
		});

		it("should accept any string when the channel is widened to `string`", () => {
			type A = GeneratorSSE<AnyOk, string>;

			expectTypeOf<{ data: AnyOk; event: "v1" }>().toExtend<A>();
		});
	});

	describe("`id` optional field", () => {
		type A = GeneratorSSE<AnyOk>;

		it("should not require `id` to be present", () => {
			expectTypeOf<{ data: AnyOk }>().toExtend<A>();
		});

		it("should type `id` as `string | undefined`", () => {
			expectTypeOf<A["id"]>().toEqualTypeOf<string | undefined>();
		});
	});

	describe("`retry` optional field", () => {
		type A = GeneratorSSE<AnyOk>;

		it("should not require `retry` to be present", () => {
			expectTypeOf<{ data: AnyOk }>().toExtend<A>();
		});

		it("should type `retry` as `number | undefined`", () => {
			expectTypeOf<A["retry"]>().toEqualTypeOf<number | undefined>();
		});
	});

	describe("required keys contract", () => {
		it("should mark only `data` as required on the parametrized form", () => {
			type A = GeneratorSSE<AnyOk, "tick">;

			expectTypeOf<RequiredKeys<A>>().toEqualTypeOf<"data">();
		});
	});

	describe("complete frame with every optional field", () => {
		it("should accept a frame populating every optional field", () => {
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
		it("should keep `data` required even on the relaxed alias", () => {
			expectTypeOf<{ event: "v1" }>().not.toExtend<AnyGeneratorSSE>();
		});

		it("should accept a frame whose `data` is `AnyFail`", () => {
			expectTypeOf<{ data: AnyFail }>().toExtend<AnyGeneratorSSE>();
		});

		it("should accept any string for the `event` channel", () => {
			expectTypeOf<{
				data: AnyOk;
				event: "v1";
			}>().toExtend<AnyGeneratorSSE>();
		});

		it("should accept any concrete `GeneratorSSE<X, Y>` as a subtype", () => {
			type A = GeneratorSSE<Ok<{ a: true }, 1>, "tick">;

			expectTypeOf<A>().toExtend<AnyGeneratorSSE>();
		});

		it("should widen `data` and `event` to `any` while leaving `id` and `retry` narrow", () => {
			expectTypeOf<AnyGeneratorSSE["data"]>().toBeAny();
			expectTypeOf<AnyGeneratorSSE["event"]>().toBeAny();
			expectTypeOf<AnyGeneratorSSE["id"]>().toEqualTypeOf<
				string | undefined
			>();
			expectTypeOf<AnyGeneratorSSE["retry"]>().toEqualTypeOf<
				number | undefined
			>();
		});

		it("should be usable as an array element type", () => {
			expectTypeOf<GeneratorSSE<Ok<{ a: true }, 1>, "tick">[]>().toExtend<
				AnyGeneratorSSE[]
			>();
		});
	});
});
