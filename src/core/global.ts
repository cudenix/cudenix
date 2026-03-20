import type { StandardSchemaV1 } from "@/types/standard-schema";

declare global {
	namespace Cudenix {
		type InferValidatorError<Type> = Type extends StandardSchemaV1
			? Type extends {
					"~types"?: unknown;
				}
				? NonNullable<Type["~types"]> extends {
						issue: infer Issue;
					}
					? Issue
					: StandardSchemaV1.Issue[]
				: StandardSchemaV1.Issue[]
			: Type;

		type InferValidatorInput<Type> = Type extends StandardSchemaV1
			? StandardSchemaV1.InferInput<Type>
			: Type;

		type InferValidatorOutput<Type> = Type extends StandardSchemaV1
			? StandardSchemaV1.InferOutput<Type>
			: Type;
	}
}
