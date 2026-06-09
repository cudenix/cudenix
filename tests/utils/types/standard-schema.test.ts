import { describe, expectTypeOf, it } from "bun:test";

import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

describe("StandardSchemaV1", () => {
	describe("structural shape", () => {
		test('should expose the "~standard" property', () => {
			expectTypeOf<StandardSchemaV1<string>>().toHaveProperty(
				"~standard",
			);
		});

		test('should resolve "~standard" to `Props`', () => {
			expectTypeOf<
				StandardSchemaV1<string, number>["~standard"]
			>().toEqualTypeOf<StandardSchemaV1.Props<string, number>>();
		});

		it("should accept a concrete object that satisfies the spec", () => {
			const a = {
				"~standard": {
					validate: (value: unknown) => ({ value: value as string }),
					vendor: "v1",
					version: 1,
				},
			} as const;

			expectTypeOf<typeof a>().toExtend<
				StandardSchemaV1<unknown, string>
			>();
		});
	});

	describe("`Props` member", () => {
		it("should carry `vendor` as a `string`", () => {
			expectTypeOf<
				StandardSchemaV1.Props<string>["vendor"]
			>().toEqualTypeOf<string>();
		});

		it("should carry `version` as the literal `1`", () => {
			expectTypeOf<
				StandardSchemaV1.Props<string>["version"]
			>().toEqualTypeOf<1>();
		});

		it("should type `validate` to return `Result | Promise<Result>`", () => {
			expectTypeOf<
				ReturnType<StandardSchemaV1.Props<string>["validate"]>
			>().toEqualTypeOf<
				| StandardSchemaV1.Result<string>
				| Promise<StandardSchemaV1.Result<string>>
			>();
		});

		it("should type the first `validate` parameter as `unknown`", () => {
			expectTypeOf<
				Parameters<StandardSchemaV1.Props<string>["validate"]>[0]
			>().toBeUnknown();
		});

		it("should type the second `validate` parameter as optional `Options`", () => {
			expectTypeOf<
				Parameters<StandardSchemaV1.Props<string>["validate"]>[1]
			>().toEqualTypeOf<StandardSchemaV1.Options | undefined>();
		});

		it("should type `types` as optional `Types`", () => {
			expectTypeOf<
				StandardSchemaV1.Props<string, number>["types"]
			>().toEqualTypeOf<
				StandardSchemaV1.Types<string, number> | undefined
			>();
		});
	});

	describe("default type parameter", () => {
		it("should default `Output` to `Input`", () => {
			expectTypeOf<StandardSchemaV1<number>>().toEqualTypeOf<
				StandardSchemaV1<number, number>
			>();
		});

		it("should let `Output` diverge from `Input` when supplied", () => {
			expectTypeOf<StandardSchemaV1<string, number>>().not.toEqualTypeOf<
				StandardSchemaV1<string, string>
			>();
		});

		it("should default both parameters to `unknown`", () => {
			expectTypeOf<StandardSchemaV1>().toEqualTypeOf<
				StandardSchemaV1<unknown, unknown>
			>();
		});
	});

	describe("`Result` union", () => {
		it("should resolve to `SuccessResult | FailureResult`", () => {
			expectTypeOf<StandardSchemaV1.Result<string>>().toEqualTypeOf<
				| StandardSchemaV1.SuccessResult<string>
				| StandardSchemaV1.FailureResult
			>();
		});

		it("should type `SuccessResult.value` as the output", () => {
			expectTypeOf<
				StandardSchemaV1.SuccessResult<number>["value"]
			>().toEqualTypeOf<number>();
		});

		it("should type `SuccessResult.issues` as optional `undefined`", () => {
			expectTypeOf<
				StandardSchemaV1.SuccessResult<number>["issues"]
			>().toBeUndefined();
		});

		it("should type `FailureResult.issues` as a `ReadonlyArray<Issue>`", () => {
			expectTypeOf<
				StandardSchemaV1.FailureResult["issues"]
			>().toEqualTypeOf<ReadonlyArray<StandardSchemaV1.Issue>>();
		});

		it("should reject a mutable `Issue[]` for `FailureResult.issues`", () => {
			expectTypeOf<StandardSchemaV1.Issue[]>().not.toEqualTypeOf<
				StandardSchemaV1.FailureResult["issues"]
			>();
		});
	});

	describe("`Issue` shape", () => {
		it("should type `message` as a `string`", () => {
			expectTypeOf<
				StandardSchemaV1.Issue["message"]
			>().toEqualTypeOf<string>();
		});

		it("should type `path` as an optional readonly key/segment array", () => {
			expectTypeOf<StandardSchemaV1.Issue["path"]>().toEqualTypeOf<
				| ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment>
				| undefined
			>();
		});
	});

	describe("`PathSegment` shape", () => {
		it("should type `key` as a `PropertyKey`", () => {
			expectTypeOf<
				StandardSchemaV1.PathSegment["key"]
			>().toEqualTypeOf<PropertyKey>();
		});
	});

	describe("`Options` shape", () => {
		it("should type `libraryOptions` as an optional record", () => {
			expectTypeOf<
				StandardSchemaV1.Options["libraryOptions"]
			>().toEqualTypeOf<Record<string, unknown> | undefined>();
		});
	});

	describe("`Types` shape", () => {
		it("should expose `input` and `output` as declared", () => {
			expectTypeOf<
				StandardSchemaV1.Types<string, number>["input"]
			>().toEqualTypeOf<string>();
			expectTypeOf<
				StandardSchemaV1.Types<string, number>["output"]
			>().toEqualTypeOf<number>();
		});

		it("should default `output` to `input`", () => {
			expectTypeOf<StandardSchemaV1.Types<boolean>>().toEqualTypeOf<
				StandardSchemaV1.Types<boolean, boolean>
			>();
		});
	});
});

describe("StandardSchemaV1.InferInput", () => {
	describe("primitive types", () => {
		it("should resolve to the schema input", () => {
			expectTypeOf<
				StandardSchemaV1.InferInput<StandardSchemaV1<string>>
			>().toEqualTypeOf<string>();
		});
	});

	describe("input/output divergence", () => {
		it("should resolve to the input when it differs from the output", () => {
			interface A extends StandardSchemaV1<string, number> {}

			expectTypeOf<
				StandardSchemaV1.InferInput<A>
			>().toEqualTypeOf<string>();
		});
	});

	describe("object types", () => {
		it("should resolve to a structured input shape", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<
				StandardSchemaV1.InferInput<StandardSchemaV1<A>>
			>().toEqualTypeOf<A>();
		});
	});

	describe("rejected inputs", () => {
		it("should reject a non-schema type argument", () => {
			// @ts-expect-error - `string` is not a `StandardSchemaV1`
			type _A = StandardSchemaV1.InferInput<string>;
		});
	});
});

describe("StandardSchemaV1.InferOutput", () => {
	describe("primitive types", () => {
		it("should resolve to the schema output", () => {
			expectTypeOf<
				StandardSchemaV1.InferOutput<StandardSchemaV1<string>>
			>().toEqualTypeOf<string>();
		});
	});

	describe("input/output divergence", () => {
		it("should resolve to the output when it differs from the input", () => {
			interface A extends StandardSchemaV1<string, number> {}

			expectTypeOf<
				StandardSchemaV1.InferOutput<A>
			>().toEqualTypeOf<number>();
		});
	});

	describe("object types", () => {
		it("should resolve to a structured output shape", () => {
			interface A {
				a: string;
				b: number;
			}

			expectTypeOf<
				StandardSchemaV1.InferOutput<StandardSchemaV1<unknown, A>>
			>().toEqualTypeOf<A>();
		});
	});

	describe("rejected inputs", () => {
		it("should reject a non-schema type argument", () => {
			// @ts-expect-error - `string` is not a `StandardSchemaV1`
			type _A = StandardSchemaV1.InferOutput<string>;
		});
	});
});
