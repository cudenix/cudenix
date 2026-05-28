import type { Error } from "@/core/error";
import type { MaybePromise } from "@/types/maybe-promise";

/**
 * @module
 * Validator types: the runtime plugin contract used to validate each request
 * slot, the type-level helpers that infer inputs, outputs, and errors from
 * user schemas, and the compiled descriptor stored on the chain.
 */

/**
 * Runtime contract every validator adapter (Standard Schema, custom) must
 * satisfy. Registered once on the app and invoked per request slot, it
 * receives the user-supplied schema, the raw incoming value, and the slot
 * key, and returns the validated payload along with a success flag.
 *
 * `content` on success is the parsed value written back onto
 * `context.request[type]`. On failure it is the issue (or issues) folded
 * into the `422` {@link Error} envelope emitted by the validator step.
 * The function may resolve synchronously or asynchronously — the runtime
 * awaits both paths uniformly through {@link MaybePromise}.
 *
 * @param schema - User-supplied schema for the slot, as registered through
 *   {@link ValidatorOptions}.
 * @param input - Raw value pulled from the request slot before validation.
 * @param type - Slot key being validated; one of the keys of
 *   {@link ValidatorRequest}.
 * @returns A `{ content, success }` pair, possibly wrapped in a promise.
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
 * Map each request slot in `T` to the issue type its schema produces, via the
 * ambient `Cudenix.InferValidatorError`. Used to type the per-slot details
 * carried by the `422` envelope a validator emits on failure.
 *
 * Slots without a schema fall through as their declared value type. The
 * mapping is shallow — only top-level slot keys are walked.
 *
 * @typeParam T - Partial {@link ValidatorRequest} whose slots hold schemas.
 * @example
 * ```typescript
 * type A = DeepInferValidatorError<{ body: SomeSchema; query: SomeSchema }>;
 * // { body: BodyIssues; query: QueryIssues }
 * ```
 */
export type DeepInferValidatorError<T extends object> = {
	[K in keyof T]: Cudenix.InferValidatorError<T[K]>;
};

/**
 * Map each request slot in `T` to the input type its schema accepts, via the
 * ambient `Cudenix.InferValidatorInput`. Drives the `request` shape recorded
 * in the client-facing route tree — the pre-validation payload a caller must
 * send, in contrast to the parsed value handlers receive via
 * {@link DeepInferValidatorOutput}.
 *
 * Slots without a schema fall through as their declared value type. The
 * mapping is shallow — only top-level slot keys are walked.
 *
 * @typeParam T - Partial {@link ValidatorRequest} whose slots hold schemas.
 * @example
 * ```typescript
 * type A = DeepInferValidatorInput<{ body: SomeSchema }>;
 * // { body: BodyInput }
 * ```
 */
export type DeepInferValidatorInput<T extends object> = {
	[K in keyof T]: Cudenix.InferValidatorInput<T[K]>;
};

/**
 * Map each request slot in `T` to the output type its schema produces, via
 * the ambient `Cudenix.InferValidatorOutput`. Drives the type of the
 * validated value written back into `context.request` and consumed by later
 * middlewares, stores, and routes.
 *
 * Slots without a schema fall through as their declared value type. The
 * mapping is shallow — only top-level slot keys are walked.
 *
 * @typeParam T - Partial {@link ValidatorRequest} whose slots hold schemas.
 * @example
 * ```typescript
 * type A = DeepInferValidatorOutput<{ body: SomeSchema }>;
 * // { body: BodyOutput }
 * ```
 */
export type DeepInferValidatorOutput<T extends object> = {
	[K in keyof T]: Cudenix.InferValidatorOutput<T[K]>;
};

/**
 * Discriminated union of per-slot error entries built from `T`. Each member
 * has the shape `{ details: [SlotError]; type: SlotKey }`, so a consumer can
 * narrow on `type` to read the matching `details` payload.
 *
 * @typeParam T - Per-slot error map, typically the result of
 *   {@link DeepInferValidatorError}.
 * @example
 * ```typescript
 * type A = ValidatorErrorDetails<{ body: BodyIssues; query: QueryIssues }>;
 * // | { details: [BodyIssues]; type: "body" }
 * // | { details: [QueryIssues]; type: "query" }
 * ```
 */
export type ValidatorErrorDetails<T extends object> = {
	[K in keyof T]: { details: [T[K]]; type: K };
}[keyof T];

/**
 * Wrap a per-slot error map into the `422`-keyed {@link Error} envelope the
 * validator step emits on failure. Used by the module compiler to fold the
 * validator's contribution into the surrounding error dictionary.
 *
 * The wrapped content is a one-element tuple `[{ details: [...] }]` whose
 * inner detail unions every slot via {@link ValidatorErrorDetails}.
 *
 * @typeParam T - Per-slot error map, typically the result of
 *   {@link DeepInferValidatorError}.
 * @example
 * ```typescript
 * type A = TransformValidatorError<{ body: BodyIssues }>;
 * // { 422: Error<[{ details: [{ details: [BodyIssues]; type: "body" }] }], 422> }
 * ```
 */
export interface TransformValidatorError<T extends object> {
	422: Error<[{ details: [ValidatorErrorDetails<T>] }], 422>;
}

/**
 * Merge two per-slot request maps with right-side precedence. For each slot,
 * if `U` declares a concrete type (not `unknown`) it wins; otherwise `T`'s
 * declaration carries through. Slots that are `unknown` on both sides are
 * dropped so they do not pollute downstream signatures.
 *
 * Used by `Module` to thread previously-declared inputs/outputs through new
 * validator and route registrations, so each unit sees the cumulative shape
 * of the request rather than only the slots it touches.
 *
 * @typeParam T - Base per-slot map, usually the parent module's accumulator.
 * @typeParam U - New per-slot map contributed by the current registration.
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
 * Shape of the five request slots a validator may operate on. Each generic
 * defaults to `unknown` so a partial declaration can refine only the slots
 * it cares about and leave the rest opaque for later steps to narrow.
 *
 * The same key set drives the runtime: `processValidators` iterates these
 * slots in registration order and writes the parsed value back onto
 * `context.request[slot]`.
 *
 * @typeParam Body - Parsed request body.
 * @typeParam Cookies - Parsed cookie dictionary.
 * @typeParam Headers - Parsed request headers.
 * @typeParam Params - Parsed route parameters.
 * @typeParam Query - Parsed query string.
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
 * Compiled validator descriptor stored on the chain. Produced by
 * `module.validator` (or the per-route `validator` option) from a
 * {@link ValidatorOptions} argument, then consumed by `processValidators`
 * at request time.
 *
 * `keys` is pre-extracted from `request` so the runtime can iterate slots
 * without rebuilding the array on every request. `type: "VALIDATOR"` is the
 * discriminant the chain walker uses to dispatch on link kind.
 *
 * @typeParam Request - Partial {@link ValidatorRequest} of schemas declared
 *   for this validator.
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
 * Wildcard alias matching any {@link Validator} regardless of its request
 * shape. Reach for it in container or chain types where the concrete schemas
 * are irrelevant — for example, the union of link kinds walked by the chain.
 */
export type AnyValidator = Validator<any>;

/**
 * Options accepted by `module.validator` and the per-route `validator`
 * option. Just carries the per-slot schema map; the runtime extracts `keys`
 * and tags `type` when compiling the descriptor.
 *
 * @typeParam Request - Partial {@link ValidatorRequest} of schemas being
 *   registered.
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
 * Wildcard alias matching any {@link ValidatorOptions} regardless of its
 * request shape. Used where the concrete schemas are irrelevant — for
 * example, the runtime body of `module.validator`, which only reads
 * `Object.keys(options.request)`.
 */
export type AnyValidatorOptions = ValidatorOptions<any>;
