import { describe, expectTypeOf, test } from "bun:test";

import "@/core/global";
import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

describe("Cudenix.InferValidatorInput", () => {
	describe("schema slots", () => {
		test("should resolve a schema to its declared input type", () => {
			interface A
				extends StandardSchemaV1<{ a: string }, { b: number }> {}

			expectTypeOf<Cudenix.InferValidatorInput<A>>().toEqualTypeOf<{
				a: string;
			}>();
		});

		test("should resolve the input from a schema declaring only the input generic", () => {
			interface A extends StandardSchemaV1<{ a: string }> {}

			expectTypeOf<Cudenix.InferValidatorInput<A>>().toEqualTypeOf<{
				a: string;
			}>();
		});

		test("should resolve a bare schema's input to `unknown`", () => {
			expectTypeOf<
				Cudenix.InferValidatorInput<StandardSchemaV1>
			>().toBeUnknown();
		});
	});

	describe("non-schema slots", () => {
		test("should let a plain object fall through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorInput<{ a: string }>
			>().toEqualTypeOf<{ a: string }>();
		});

		test("should let a primitive fall through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorInput<number>
			>().toEqualTypeOf<number>();
		});

		test("should leave an opaque `unknown` input as `unknown`", () => {
			expectTypeOf<Cudenix.InferValidatorInput<unknown>>().toBeUnknown();
		});
	});

	describe("distributive behaviour", () => {
		test("should pass a union of non-schema members through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorInput<string | number>
			>().toEqualTypeOf<string | number>();
		});

		test("should resolve `never` to `never`", () => {
			expectTypeOf<Cudenix.InferValidatorInput<never>>().toBeNever();
		});

		test("should resolve `any` to `any`", () => {
			expectTypeOf<Cudenix.InferValidatorInput<any>>().toBeAny();
		});
	});
});

describe("Cudenix.InferValidatorOutput", () => {
	describe("schema slots", () => {
		test("should resolve a schema to its declared output type", () => {
			interface A
				extends StandardSchemaV1<{ a: string }, { b: number }> {}

			expectTypeOf<Cudenix.InferValidatorOutput<A>>().toEqualTypeOf<{
				b: number;
			}>();
		});

		test("should default the output to the input when only one generic is set", () => {
			interface A extends StandardSchemaV1<{ a: string }> {}

			expectTypeOf<Cudenix.InferValidatorOutput<A>>().toEqualTypeOf<{
				a: string;
			}>();
		});

		test("should resolve a bare schema's output to `unknown`", () => {
			expectTypeOf<
				Cudenix.InferValidatorOutput<StandardSchemaV1>
			>().toBeUnknown();
		});
	});

	describe("non-schema slots", () => {
		test("should let a plain object fall through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorOutput<{ a: string }>
			>().toEqualTypeOf<{ a: string }>();
		});

		test("should let a primitive fall through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorOutput<string>
			>().toEqualTypeOf<string>();
		});

		test("should leave an opaque `unknown` output as `unknown`", () => {
			expectTypeOf<Cudenix.InferValidatorOutput<unknown>>().toBeUnknown();
		});
	});

	describe("distributive behaviour", () => {
		test("should pass a union of non-schema members through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorOutput<string | number>
			>().toEqualTypeOf<string | number>();
		});

		test("should resolve `never` to `never`", () => {
			expectTypeOf<Cudenix.InferValidatorOutput<never>>().toBeNever();
		});

		test("should resolve `any` to `any`", () => {
			expectTypeOf<Cudenix.InferValidatorOutput<any>>().toBeAny();
		});
	});
});

describe("Cudenix.InferValidatorError", () => {
	describe("schema slots", () => {
		test("should resolve a schema to its declared issue type", () => {
			interface A extends StandardSchemaV1 {
				"~types": { issue: B };
			}
			interface B {
				message: string;
			}

			expectTypeOf<Cudenix.InferValidatorError<A>>().toEqualTypeOf<B>();
		});

		test("should fall back to the issue array for a bare schema", () => {
			interface A extends StandardSchemaV1 {}

			expectTypeOf<Cudenix.InferValidatorError<A>>().toEqualTypeOf<
				StandardSchemaV1.Issue[]
			>();
		});

		test("should fall back to the issue array when `~types` lacks an issue key", () => {
			interface A extends StandardSchemaV1 {
				"~types": { a: string };
			}

			expectTypeOf<Cudenix.InferValidatorError<A>>().toEqualTypeOf<
				StandardSchemaV1.Issue[]
			>();
		});
	});

	describe("non-schema slots", () => {
		test("should let a plain object fall through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorError<{ a: string }>
			>().toEqualTypeOf<{ a: string }>();
		});

		test("should let a primitive fall through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorError<string>
			>().toEqualTypeOf<string>();
		});

		test("should leave an opaque `unknown` input as `unknown`", () => {
			expectTypeOf<Cudenix.InferValidatorError<unknown>>().toBeUnknown();
		});
	});

	describe("distributive behaviour", () => {
		test("should pass a union of non-schema members through unchanged", () => {
			expectTypeOf<
				Cudenix.InferValidatorError<string | number>
			>().toEqualTypeOf<string | number>();
		});

		test("should resolve `never` to `never`", () => {
			expectTypeOf<Cudenix.InferValidatorError<never>>().toBeNever();
		});

		test("should resolve `any` to `any`", () => {
			expectTypeOf<Cudenix.InferValidatorError<any>>().toBeAny();
		});
	});
});
