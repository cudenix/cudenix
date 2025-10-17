import type { InferInput, InferOutput, Issue, StandardSchemaV1 } from "@/types";

declare global {
	namespace Cudenix {
		type InferValidatorError<Type> = Type extends StandardSchemaV1
			? Issue[]
			: Type;

		type InferValidatorInput<Type> = Type extends StandardSchemaV1
			? InferInput<Type>
			: Type;

		type InferValidatorOutput<Type> = Type extends StandardSchemaV1
			? InferOutput<Type>
			: Type;
	}
}
