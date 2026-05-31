import { describe, expectTypeOf, test } from "bun:test";

import type { Error } from "@/core/error";
import "@/core/global";
import type {
	AnyValidator,
	AnyValidatorOptions,
	DeepInferValidatorError,
	DeepInferValidatorInput,
	DeepInferValidatorOutput,
	MergeInferValidatorRequest,
	TransformValidatorError,
	Validator,
	ValidatorOptions,
	ValidatorPlugin,
	ValidatorRequest,
} from "@/core/validator";
import type { MaybePromise } from "@/types/maybe-promise";
import type { StandardSchemaV1 } from "@/types/standard-schema";

describe("ValidatorPlugin", () => {
	describe("signature", () => {
		test("should resolve to the full plugin function signature", () => {
			expectTypeOf<ValidatorPlugin>().toEqualTypeOf<
				(
					schema: any,
					input: unknown,
					type: keyof ValidatorRequest,
				) => MaybePromise<{ content: unknown; success: boolean }>
			>();
		});
	});

	describe("parameter types", () => {
		test("should type the schema parameter as `any`", () => {
			expectTypeOf<Parameters<ValidatorPlugin>[0]>().toBeAny();
		});

		test("should type the input parameter as `unknown`", () => {
			expectTypeOf<Parameters<ValidatorPlugin>[1]>().toBeUnknown();
		});

		test("should type the slot parameter as the union of request keys", () => {
			expectTypeOf<Parameters<ValidatorPlugin>[2]>().toEqualTypeOf<
				"body" | "cookies" | "headers" | "params" | "query"
			>();
		});

		test("should take exactly three parameters", () => {
			expectTypeOf<
				Parameters<ValidatorPlugin>["length"]
			>().toEqualTypeOf<3>();
		});
	});

	describe("return type", () => {
		test("should resolve to a `MaybePromise` of the validated payload", () => {
			expectTypeOf<ReturnType<ValidatorPlugin>>().toEqualTypeOf<
				MaybePromise<{ content: unknown; success: boolean }>
			>();
		});

		test("should collapse to the `{ content, success }` pair under `Awaited<...>`", () => {
			expectTypeOf<Awaited<ReturnType<ValidatorPlugin>>>().toEqualTypeOf<{
				content: unknown;
				success: boolean;
			}>();
		});
	});

	describe("assignable implementations", () => {
		test("should accept a synchronous implementation", () => {
			expectTypeOf<
				(
					schema: any,
					input: unknown,
					type: keyof ValidatorRequest,
				) => { content: unknown; success: boolean }
			>().toExtend<ValidatorPlugin>();
		});

		test("should accept an asynchronous implementation", () => {
			expectTypeOf<
				(
					schema: any,
					input: unknown,
					type: keyof ValidatorRequest,
				) => Promise<{ content: unknown; success: boolean }>
			>().toExtend<ValidatorPlugin>();
		});

		test("should accept an implementation that ignores trailing parameters", () => {
			expectTypeOf<
				(schema: any) => { content: unknown; success: boolean }
			>().toExtend<ValidatorPlugin>();
		});

		test("should accept an implementation widening the slot parameter to `string`", () => {
			expectTypeOf<
				(
					schema: any,
					input: unknown,
					type: string,
				) => { content: unknown; success: boolean }
			>().toExtend<ValidatorPlugin>();
		});
	});

	describe("rejected implementations", () => {
		test("should reject a return value missing the `success` flag", () => {
			expectTypeOf<
				(
					schema: any,
					input: unknown,
					type: keyof ValidatorRequest,
				) => { content: unknown }
			>().not.toExtend<ValidatorPlugin>();
		});

		test("should reject a non-object return value", () => {
			expectTypeOf<
				(
					schema: any,
					input: unknown,
					type: keyof ValidatorRequest,
				) => boolean
			>().not.toExtend<ValidatorPlugin>();
		});

		test("should reject an implementation narrowing the slot parameter", () => {
			expectTypeOf<
				(
					schema: any,
					input: unknown,
					type: "body",
				) => { content: unknown; success: boolean }
			>().not.toExtend<ValidatorPlugin>();
		});
	});
});

describe("DeepInferValidatorError", () => {
	describe("schema slots", () => {
		test("should resolve a slot to the schema's declared issue type", () => {
			interface A extends StandardSchemaV1 {
				"~types": { issue: B };
			}
			interface B {
				message: string;
			}

			expectTypeOf<DeepInferValidatorError<{ body: A }>>().toEqualTypeOf<{
				body: B;
			}>();
		});
	});

	describe("non-schema slots", () => {
		test("should let a plain object slot fall through unchanged", () => {
			expectTypeOf<
				DeepInferValidatorError<{ body: { a: string } }>
			>().toEqualTypeOf<{ body: { a: string } }>();
		});

		test("should leave an opaque `unknown` slot as `unknown`", () => {
			expectTypeOf<
				DeepInferValidatorError<{ body: unknown }>
			>().toEqualTypeOf<{ body: unknown }>();
		});
	});

	describe("multiple slots", () => {
		test("should map every slot independently", () => {
			interface A extends StandardSchemaV1 {
				"~types": { issue: B };
			}
			interface B {
				message: string;
			}

			expectTypeOf<
				DeepInferValidatorError<{ body: A; query: { c: boolean } }>
			>().toEqualTypeOf<{ body: B; query: { c: boolean } }>();
		});
	});
});

describe("DeepInferValidatorInput", () => {
	describe("schema slots", () => {
		test("should resolve a slot to the schema's input type", () => {
			interface A
				extends StandardSchemaV1<{ a: string }, { b: number }> {}

			expectTypeOf<DeepInferValidatorInput<{ body: A }>>().toEqualTypeOf<{
				body: { a: string };
			}>();
		});
	});

	describe("non-schema slots", () => {
		test("should let a plain object slot fall through unchanged", () => {
			expectTypeOf<
				DeepInferValidatorInput<{ body: { a: string } }>
			>().toEqualTypeOf<{ body: { a: string } }>();
		});

		test("should leave an opaque `unknown` slot as `unknown`", () => {
			expectTypeOf<
				DeepInferValidatorInput<{ body: unknown }>
			>().toEqualTypeOf<{ body: unknown }>();
		});
	});

	describe("multiple slots", () => {
		test("should map a schema slot to its input while passing others through", () => {
			interface A
				extends StandardSchemaV1<{ a: string }, { b: number }> {}

			expectTypeOf<
				DeepInferValidatorInput<{ body: A; query: { c: boolean } }>
			>().toEqualTypeOf<{ body: { a: string }; query: { c: boolean } }>();
		});
	});
});

describe("DeepInferValidatorOutput", () => {
	describe("schema slots", () => {
		test("should resolve a slot to the schema's output type", () => {
			interface A
				extends StandardSchemaV1<{ a: string }, { b: number }> {}

			expectTypeOf<
				DeepInferValidatorOutput<{ body: A }>
			>().toEqualTypeOf<{ body: { b: number } }>();
		});
	});

	describe("non-schema slots", () => {
		test("should let a plain object slot fall through unchanged", () => {
			expectTypeOf<
				DeepInferValidatorOutput<{ body: { a: string } }>
			>().toEqualTypeOf<{ body: { a: string } }>();
		});

		test("should leave an opaque `unknown` slot as `unknown`", () => {
			expectTypeOf<
				DeepInferValidatorOutput<{ body: unknown }>
			>().toEqualTypeOf<{ body: unknown }>();
		});
	});

	describe("multiple slots", () => {
		test("should map a schema slot to its output while passing others through", () => {
			interface A
				extends StandardSchemaV1<{ a: string }, { b: number }> {}

			expectTypeOf<
				DeepInferValidatorOutput<{ body: A; query: { c: boolean } }>
			>().toEqualTypeOf<{ body: { b: number }; query: { c: boolean } }>();
		});
	});
});

describe("TransformValidatorError", () => {
	describe("envelope shape", () => {
		test("should wrap the per-slot map into a `422`-keyed error envelope", () => {
			interface A {
				message: string;
			}
			interface B {
				code: number;
			}

			expectTypeOf<
				TransformValidatorError<{ body: A; query: B }>
			>().toEqualTypeOf<{ 422: Error<{ body?: A; query?: B }, 422> }>();
		});

		test("should key the envelope solely by the numeric literal `422`", () => {
			interface A {
				message: string;
			}

			expectTypeOf<
				keyof TransformValidatorError<{ body: A }>
			>().toEqualTypeOf<422>();
		});
	});

	describe("content typing", () => {
		test("should make every slot optional in the wrapped content", () => {
			interface A {
				message: string;
			}
			interface B {
				code: number;
			}

			expectTypeOf<
				TransformValidatorError<{ body: A; query: B }>[422]["content"]
			>().toEqualTypeOf<{ body?: A; query?: B }>();
		});

		test("should fix the envelope status to the `422` literal", () => {
			interface A {
				message: string;
			}

			expectTypeOf<
				TransformValidatorError<{ body: A }>[422]["status"]
			>().toEqualTypeOf<422>();
		});

		test("should fix the envelope `success` flag to `false`", () => {
			interface A {
				message: string;
			}

			expectTypeOf<
				TransformValidatorError<{ body: A }>[422]["success"]
			>().toEqualTypeOf<false>();
		});
	});
});

describe("MergeInferValidatorRequest", () => {
	describe("right-side precedence", () => {
		test("should let a concrete slot in the second operand win over the first", () => {
			expectTypeOf<
				MergeInferValidatorRequest<
					{
						body: { a: string };
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					},
					{
						body: { b: number };
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					}
				>
			>().branded.toEqualTypeOf<{ body: { b: number } }>();
		});

		test("should take every concrete slot from the second operand when both are concrete", () => {
			expectTypeOf<
				MergeInferValidatorRequest<
					{
						body: { a: 1 };
						cookies: { a: 1 };
						headers: { a: 1 };
						params: { a: 1 };
						query: { a: 1 };
					},
					{
						body: { b: 2 };
						cookies: { b: 2 };
						headers: { b: 2 };
						params: { b: 2 };
						query: { b: 2 };
					}
				>
			>().branded.toEqualTypeOf<{
				body: { b: 2 };
				cookies: { b: 2 };
				headers: { b: 2 };
				params: { b: 2 };
				query: { b: 2 };
			}>();
		});
	});

	describe("left-side fallback", () => {
		test("should keep the first operand's slot when the second is `unknown`", () => {
			expectTypeOf<
				MergeInferValidatorRequest<
					{
						body: { a: string };
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					},
					{
						body: unknown;
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: { b: number };
					}
				>
			>().branded.toEqualTypeOf<{
				body: { a: string };
				query: { b: number };
			}>();
		});
	});

	describe("dropped slots", () => {
		test("should drop a slot that is `unknown` on both operands", () => {
			expectTypeOf<
				keyof MergeInferValidatorRequest<
					{
						body: { a: string };
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					},
					{
						body: unknown;
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					}
				>
			>().toEqualTypeOf<"body">();
		});

		test("should resolve to an empty object when every slot is mutually `unknown`", () => {
			expectTypeOf<
				MergeInferValidatorRequest<
					{
						body: unknown;
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					},
					{
						body: unknown;
						cookies: unknown;
						headers: unknown;
						params: unknown;
						query: unknown;
					}
				>
			>().branded.toEqualTypeOf<NonNullable<unknown>>();
		});
	});
});

describe("ValidatorRequest", () => {
	describe("default parameters", () => {
		test("should default every slot to `unknown`", () => {
			expectTypeOf<ValidatorRequest>().toEqualTypeOf<{
				body: unknown;
				cookies: unknown;
				headers: unknown;
				params: unknown;
				query: unknown;
			}>();
		});

		test("should type an unrefined slot as `unknown`", () => {
			expectTypeOf<ValidatorRequest["body"]>().toBeUnknown();
		});
	});

	describe("refined slots", () => {
		test("should refine only the body slot from the first generic", () => {
			expectTypeOf<ValidatorRequest<{ a: string }>>().toEqualTypeOf<{
				body: { a: string };
				cookies: unknown;
				headers: unknown;
				params: unknown;
				query: unknown;
			}>();
		});

		test("should map each positional generic to its matching slot", () => {
			expectTypeOf<ValidatorRequest<1, 2, 3, 4, 5>>().toEqualTypeOf<{
				body: 1;
				cookies: 2;
				headers: 3;
				params: 4;
				query: 5;
			}>();
		});

		test("should expose the refined value type under indexed access", () => {
			expectTypeOf<
				ValidatorRequest<{ a: string }>["body"]
			>().toEqualTypeOf<{ a: string }>();
		});
	});

	describe("key set", () => {
		test("should resolve its keys to the five request slots", () => {
			expectTypeOf<keyof ValidatorRequest>().toEqualTypeOf<
				"body" | "cookies" | "headers" | "params" | "query"
			>();
		});
	});
});

describe("Validator", () => {
	describe("descriptor shape", () => {
		test("should resolve to the compiled descriptor shape", () => {
			expectTypeOf<Validator<{ body: { a: string } }>>().toEqualTypeOf<{
				keys: (keyof ValidatorRequest)[];
				request: { body: { a: string } };
				type: "VALIDATOR";
			}>();
		});
	});

	describe("keys property", () => {
		test("should type `keys` as an array of request slot keys", () => {
			expectTypeOf<
				Validator<{ body: { a: string } }>["keys"]
			>().toEqualTypeOf<
				("body" | "cookies" | "headers" | "params" | "query")[]
			>();
		});
	});

	describe("request property", () => {
		test("should expose the request map verbatim", () => {
			interface A {
				body: { a: string };
			}

			expectTypeOf<Validator<A>["request"]>().toEqualTypeOf<A>();
		});
	});

	describe("type discriminant", () => {
		test("should fix the discriminant to the `VALIDATOR` literal", () => {
			expectTypeOf<
				Validator<{ body: { a: string } }>["type"]
			>().toEqualTypeOf<"VALIDATOR">();
		});

		test("should not widen the discriminant to `string`", () => {
			expectTypeOf<
				Validator<{ body: { a: string } }>["type"]
			>().not.toEqualTypeOf<string>();
		});
	});
});

describe("AnyValidator", () => {
	describe("subtype relations", () => {
		test("should accept a concrete validator descriptor", () => {
			expectTypeOf<
				Validator<{ body: { a: string } }>
			>().toExtend<AnyValidator>();
		});

		test("should carry the `keys`, `request` and `type` properties", () => {
			expectTypeOf<AnyValidator>().toHaveProperty("keys");
			expectTypeOf<AnyValidator>().toHaveProperty("request");
			expectTypeOf<AnyValidator>().toHaveProperty("type");
		});
	});

	describe("erased request", () => {
		test("should erase the request map to `any`", () => {
			expectTypeOf<AnyValidator["request"]>().toBeAny();
		});

		test("should still fix the discriminant to the `VALIDATOR` literal", () => {
			expectTypeOf<AnyValidator["type"]>().toEqualTypeOf<"VALIDATOR">();
		});
	});
});

describe("ValidatorOptions", () => {
	describe("options shape", () => {
		test("should wrap the request map in a single `request` property", () => {
			expectTypeOf<
				ValidatorOptions<{ body: { a: string } }>
			>().toEqualTypeOf<{ request: { body: { a: string } } }>();
		});
	});

	describe("request property", () => {
		test("should expose the request map verbatim", () => {
			interface A {
				body: { a: string };
			}

			expectTypeOf<ValidatorOptions<A>["request"]>().toEqualTypeOf<A>();
		});
	});
});

describe("AnyValidatorOptions", () => {
	describe("subtype relations", () => {
		test("should accept a concrete options object", () => {
			expectTypeOf<
				ValidatorOptions<{ body: { a: string } }>
			>().toExtend<AnyValidatorOptions>();
		});

		test("should carry the `request` property", () => {
			expectTypeOf<AnyValidatorOptions>().toHaveProperty("request");
		});
	});

	describe("erased request", () => {
		test("should erase the request map to `any`", () => {
			expectTypeOf<AnyValidatorOptions["request"]>().toBeAny();
		});
	});
});
