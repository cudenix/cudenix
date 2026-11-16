import { describe, expectTypeOf, it } from "bun:test";

import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

describe("StandardSchemaV1", () => {
	it("should default `Output` to `Input`", () => {
		expectTypeOf<StandardSchemaV1<number>>().toEqualTypeOf<
			StandardSchemaV1<number, number>
		>();
	});

	it("should accept a schema whose `validate` is sync or async", () => {
		interface Sync {
			"~standard": {
				validate(value: unknown): { value: string };
				vendor: string;
				version: 1;
			};
		}
		interface Async {
			"~standard": {
				validate(value: unknown): Promise<{ issues: [] }>;
				vendor: string;
				version: 1;
			};
		}

		expectTypeOf<Sync>().toExtend<StandardSchemaV1<unknown, string>>();
		expectTypeOf<Async>().toExtend<StandardSchemaV1<unknown, string>>();
	});

	it("should discriminate a result by its `issues`", () => {
		type A = StandardSchemaV1.Result<string>;

		expectTypeOf<Extract<A, { issues?: undefined }>>().toEqualTypeOf<
			StandardSchemaV1.SuccessResult<string>
		>();
		expectTypeOf<
			Exclude<A, { issues?: undefined }>
		>().toEqualTypeOf<StandardSchemaV1.FailureResult>();
	});
});

describe("StandardSchemaV1.InferInput", () => {
	it("should resolve to the schema input", () => {
		expectTypeOf<
			StandardSchemaV1.InferInput<StandardSchemaV1<string, number>>
		>().toEqualTypeOf<string>();
	});

	it("should resolve to `unknown` for a schema that never declares `types`", () => {
		interface A {
			"~standard": {
				validate(value: unknown): { value: unknown };
				vendor: string;
				version: 1;
			};
		}

		expectTypeOf<StandardSchemaV1.InferInput<A>>().toBeUnknown();
	});

	it("should reject a type argument that is not a schema", () => {
		// @ts-expect-error - `string` is not a `StandardSchemaV1`
		type _A = StandardSchemaV1.InferInput<string>;
	});
});

describe("StandardSchemaV1.InferOutput", () => {
	it("should resolve to the schema output", () => {
		expectTypeOf<
			StandardSchemaV1.InferOutput<StandardSchemaV1<string, number>>
		>().toEqualTypeOf<number>();
	});

	it("should resolve to the input when the schema declares no output", () => {
		expectTypeOf<
			StandardSchemaV1.InferOutput<StandardSchemaV1<string>>
		>().toEqualTypeOf<string>();
	});

	it("should reject a type argument that is not a schema", () => {
		// @ts-expect-error - `string` is not a `StandardSchemaV1`
		type _A = StandardSchemaV1.InferOutput<string>;
	});
});
