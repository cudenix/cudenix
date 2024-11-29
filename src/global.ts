import type {
	InferInput,
	InferOutput,
	StandardSchemaV1,
} from "@/types/standard-schema";

declare global {
	// biome-ignore lint/style/noNamespace:
	export namespace Cudenix {
		export type InferValidatorError<Type> = Type;

		export type InferValidatorInput<Type> = Type extends StandardSchemaV1
			? InferInput<Type>
			: Type;

		export type InferValidatorOutput<Type> = Type extends StandardSchemaV1
			? InferOutput<Type>
			: Type;
	}
}
