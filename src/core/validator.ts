import type { Fail } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";
import type { StandardSchemaV1 } from "@/utils/types/standard-schema";

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
 * Runtime contract every validator adapter must satisfy. Receives the slot
 * schema, the slot value, and the slot being validated.
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
 * Infers a Standard Schema issue type.
 */
type InferValidatorError<Type> = Type extends StandardSchemaV1
	? Type extends { "~types"?: { issue: infer Issue } }
		? Issue
		: StandardSchemaV1.Issue[]
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
 * Infers a Standard Schema input type.
 */
type InferValidatorInput<Type> = Type extends StandardSchemaV1
	? StandardSchemaV1.InferInput<Type>
	: Type;

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
 * Infers a Standard Schema output type.
 */
type InferValidatorOutput<Type> = Type extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Type>
	: Type;

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
 * Merge two per-slot request maps with right-side precedence. Slots left
 * `unknown` on both sides are dropped.
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
> = [keyof T | keyof U] extends [never]
	? NonNullable<unknown>
	: {
			[K in "body" | "cookies" | "headers" | "params" | "query" as [
				unknown,
			] extends [U[K]]
				? [unknown] extends [T[K]]
					? never
					: K
				: K]: [unknown] extends [U[K]] ? T[K] : U[K];
		};

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

/**
 * Compiled {@link ValidatorOptions} descriptor tagged `"VALIDATOR"`.
 */
interface Validator<Request extends Partial<ValidatorRequest>> {
	/** Slots to validate, in declared order. */
	keys: (keyof ValidatorRequest)[];
	/** Schema for each validated slot. */
	request: Request;
	/** Discriminant used when walking the chain. */
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
