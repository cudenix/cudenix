import type {
	InferInput,
	InferOutput,
	Issue,
	StandardSchemaV1,
} from "@/types/standard-schema";

declare global {
	// biome-ignore lint/style/noNamespace:
	namespace Cudenix {
		type EventsList = Record<PropertyKey, unknown[]>;

		type I18nTranslations = unknown;

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
