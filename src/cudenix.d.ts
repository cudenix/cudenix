declare module "@cudenix/cudenix" {
	export type InferValidatorError<Type> = Type;
	export type InferValidatorInput<Type> = Type extends Record<
		"~standard",
		unknown
	>
		? NonNullable<Type["~standard"]["types"]>["input"]
		: Type;
	export type InferValidatorOutput<Type> = Type extends Record<
		"~standard",
		unknown
	>
		? NonNullable<Type["~standard"]["types"]>["output"]
		: Type;
}
