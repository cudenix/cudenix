import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

declare global {
	namespace Cudenix {
		type InferValidatorError<Type> = Type extends StandardSchemaV1
			? Type extends { "~types"?: { issue: infer Issue } }
				? Issue
				: StandardSchemaV1.Issue[]
			: Type;

		type InferValidatorInput<Type> = Type extends StandardSchemaV1
			? NonNullable<Type["~standard"]["types"]>["input"]
			: Type;

		type InferValidatorOutput<Type> = Type extends StandardSchemaV1
			? NonNullable<Type["~standard"]["types"]>["output"]
			: Type;
	}
}
