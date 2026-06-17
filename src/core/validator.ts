import type { Fail } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";
import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

/**
 * Runtime contract every validator adapter must satisfy.
 *
 * @example
 * ```typescript
 * const a: ValidatorPlugin = async (schema, input) => {
 *   const result = await schema["~standard"].validate(input);
 *
 *   return result.issues
 *     ? { content: result.issues, success: false }
 *     : { content: result.value, success: true };
 * };
 * ```
 */
export type ValidatorPlugin = (
	schema: any,
	input: unknown,
	type: keyof ValidatorRequest,
) => MaybePromise<{ content: unknown; success: boolean }>;

/**
 * Infer the issue type a Standard Schema reports on failure, falling back to
 * {@link StandardSchemaV1.Issue}`[]`. Non-schema types pass through unchanged.
 *
 * @example
 * ```typescript
 * type A = InferValidatorError<SomeSchema>;
 * // SomeSchemaIssues
 * ```
 */
export type InferValidatorError<Type> = Type extends StandardSchemaV1
	? Type extends { "~types"?: { issue: infer Issue } }
		? Issue
		: StandardSchemaV1.Issue[]
	: Type;

/**
 * Infer the input type a Standard Schema accepts via
 * {@link StandardSchemaV1.InferInput}. Non-schema types pass through unchanged.
 *
 * @example
 * ```typescript
 * type A = InferValidatorInput<SomeSchema>;
 * // SomeSchemaInput
 * ```
 */
export type InferValidatorInput<Type> = Type extends StandardSchemaV1
	? StandardSchemaV1.InferInput<Type>
	: Type;

/**
 * Infer the output type a Standard Schema produces via
 * {@link StandardSchemaV1.InferOutput}. Non-schema types pass through
 * unchanged.
 *
 * @example
 * ```typescript
 * type A = InferValidatorOutput<SomeSchema>;
 * // SomeSchemaOutput
 * ```
 */
export type InferValidatorOutput<Type> = Type extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Type>
	: Type;

/**
 * Map each request slot in `T` to the issue type its Standard Schema produces.
 *
 * @example
 * ```typescript
 * type A = DeepInferValidatorError<{ body: SomeSchema; query: SomeSchema }>;
 * // { body: BodyIssues; query: QueryIssues }
 * ```
 */
export type DeepInferValidatorError<T extends object> = {
	[K in keyof T]: InferValidatorError<T[K]>;
};

/**
 * Map each request slot in `T` to the input type its Standard Schema accepts.
 *
 * @example
 * ```typescript
 * type A = DeepInferValidatorInput<{ body: SomeSchema }>;
 * // { body: BodyInput }
 * ```
 */
export type DeepInferValidatorInput<T extends object> = {
	[K in keyof T]: InferValidatorInput<T[K]>;
};

/**
 * Map each request slot in `T` to the output type its Standard Schema
 * produces.
 *
 * @example
 * ```typescript
 * type A = DeepInferValidatorOutput<{ body: SomeSchema }>;
 * // { body: BodyOutput }
 * ```
 */
export type DeepInferValidatorOutput<T extends object> = {
	[K in keyof T]: InferValidatorOutput<T[K]>;
};

/**
 * Wrap a per-slot error map into the `422`-keyed {@link Fail} envelope.
 *
 * @example
 * ```typescript
 * type A = TransformValidatorError<{ body: BodyIssues; query: QueryIssues }>;
 * // { 422: Fail<{ body?: BodyIssues; query?: QueryIssues }, 422> }
 * ```
 */
export interface TransformValidatorError<T extends object> {
	422: Fail<Partial<T>, 422>;
}

/**
 * Merge two per-slot request maps with right-side precedence.
 *
 * @example
 * ```typescript
 * type A = MergeInferValidatorRequest<
 *   { body: { a: string }; query: unknown; cookies: unknown; headers: unknown; params: unknown },
 *   { body: unknown; query: { b: number }; cookies: unknown; headers: unknown; params: unknown }
 * >;
 * // { body: { a: string }; query: { b: number } }
 * ```
 */
export type MergeInferValidatorRequest<
	T extends Record<PropertyKey, unknown>,
	U extends Record<PropertyKey, unknown>,
> = {
	[K in "body" | "cookies" | "headers" | "params" | "query" as [
		unknown,
	] extends [U[K]]
		? [unknown] extends [T[K]]
			? never
			: K
		: K]: [unknown] extends [U[K]] ? T[K] : U[K];
};

/**
 * Shape of the five request slots a validator may operate.
 *
 * @example
 * ```typescript
 * type A = ValidatorRequest<{ a: string }, unknown, unknown, unknown, { b: number }>;
 * // { body: { a: string }; cookies: unknown; headers: unknown; params: unknown; query: { b: number } }
 * ```
 */
export interface ValidatorRequest<
	Body = unknown,
	Cookies = unknown,
	Headers = unknown,
	Params = unknown,
	Query = unknown,
> {
	body: Body;
	cookies: Cookies;
	headers: Headers;
	params: Params;
	query: Query;
}

/**
 * Compiled {@link ValidatorOptions} descriptor, tagged `"VALIDATOR"`.
 *
 * @example
 * ```typescript
 * const a: Validator<{ body: SomeSchema }> = {
 *   keys: ["body"],
 *   request: { body: someSchema },
 *   type: "VALIDATOR",
 * };
 * ```
 */
export interface Validator<Request extends Partial<ValidatorRequest>> {
	keys: (keyof ValidatorRequest)[];
	request: Request;
	type: "VALIDATOR";
}

/**
 * Any {@link Validator} regardless of its request generics.
 *
 * @example
 * ```typescript
 * const a: AnyValidator[] = [];
 * ```
 */
export type AnyValidator = Validator<any>;

/**
 * Options accepted by `module.validator` and the per-route `validator` option.
 *
 * @example
 * ```typescript
 * const a: ValidatorOptions<{ body: SomeSchema }> = {
 *   request: { body: someSchema },
 * };
 * ```
 */
export interface ValidatorOptions<Request extends Partial<ValidatorRequest>> {
	request: Request;
}

/**
 * Any {@link ValidatorOptions} regardless of its request generics.
 *
 * @example
 * ```typescript
 * const fn = (options: AnyValidatorOptions) => Object.keys(options.request);
 * ```
 */
export type AnyValidatorOptions = ValidatorOptions<any>;
