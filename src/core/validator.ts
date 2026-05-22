import type { Error } from "@/core/error";
import type { MaybePromise } from "@/types/maybe-promise";

/**
 * @module
 * Validator descriptors, plugin contract, and the type-level utilities that
 * fold per-request schemas into module and route inference.
 */

/**
 * Adapter that bridges the framework to a third-party validation library.
 *
 * Stored in `app.memory` under the `"validator"` key and invoked by
 * `processValidators` once per declared slot. Each call hands the plugin the
 * schema attached to that slot, the raw value pulled from
 * `context.request[key]`, and the slot name being validated; the plugin
 * decides how the schema is executed and reports the outcome back through a
 * uniform envelope:
 *
 * - `success: true` — `content` is treated as the validated value and
 *   overwrites the slot on `context.request`.
 * - `success: false` — `content` is appended to the per-slot error bucket
 *   that ultimately backs the 422 envelope. If `content` is an array, each
 *   entry is pushed individually so multi-issue results stay flat.
 *
 * The return type allows either a synchronous answer or a `Promise`, so the
 * runtime can short-circuit without paying an extra microtask when the
 * underlying library is sync.
 *
 * @param schema - Schema declared for this slot in
 *   {@link ValidatorOptions}. Typed as `any` because the framework is
 *   library-agnostic.
 * @param input - Raw value pulled from `context.request[type]` before
 *   validation.
 * @param type - Slot being validated; one of {@link ValidatorRequest}'s
 *   key names.
 * @returns Result envelope — sync or async — carrying the propagated
 *   `content` and a boolean `success` discriminant.
 * @example
 * ```typescript
 * type A = Parameters<ValidatorPlugin>;
 * // [schema: any, input: unknown, type: "body" | "cookies" | "headers" | "params" | "query"]
 *
 * type B = ReturnType<ValidatorPlugin>;
 * // MaybePromise<{ content: unknown; success: boolean }>
 *
 * type C = Awaited<ReturnType<ValidatorPlugin>>;
 * // { content: unknown; success: boolean }
 * ```
 */
export type ValidatorPlugin = (
	schema: any,
	input: unknown,
	type: keyof ValidatorRequest,
) => MaybePromise<{ content: unknown; success: boolean }>;

/**
 * Map every value of a per-slot schema record to its inferred error shape.
 *
 * Each value flows through the global `Cudenix.InferValidatorError`, which
 * returns the library-specific issue list for `StandardSchemaV1` schemas
 * and falls back to the raw `Type[Key]` otherwise. Fed into
 * {@link TransformValidatorError} so the 422 envelope produced by
 * `Module.validator` and `RouteOptions.validator` reflects the exact issue
 * type each schema can emit.
 *
 * @typeParam Type - Record mapping {@link ValidatorRequest} slot names to
 *   the schema declared for each.
 * @example
 * ```typescript
 * type A = DeepInferValidatorError<{
 *   body: StandardSchemaV1<{ id: string }>;
 *   query: { page: number };
 * }>;
 * // { body: StandardSchemaV1.Issue[]; query: { page: number } }
 *
 * type B = DeepInferValidatorError<{}>;
 * // {}
 * ```
 */
export type DeepInferValidatorError<Type extends Record<PropertyKey, unknown>> =
	{
		[Key in keyof Type]: Cudenix.InferValidatorError<Type[Key]>;
	};

/**
 * Map every value of a per-slot schema record to its inferred input shape.
 *
 * Counterpart of {@link DeepInferValidatorOutput}. Each value flows through
 * `Cudenix.InferValidatorInput`, which extracts the pre-validation type a
 * schema accepts. Used by `Module.validator` and `Module.route` to populate
 * the `inputs` half of a module's validator dictionary so route consumers
 * see the raw payload shape clients are expected to send.
 *
 * @typeParam Type - Record mapping {@link ValidatorRequest} slot names to
 *   the schema declared for each.
 * @example
 * ```typescript
 * type A = DeepInferValidatorInput<{
 *   body: StandardSchemaV1<{ raw: string }, { parsed: number }>;
 *   query: { page: number };
 * }>;
 * // { body: { raw: string }; query: { page: number } }
 *
 * type B = DeepInferValidatorInput<{ params: { id: string } }>;
 * // { params: { id: string } }
 * ```
 */
export type DeepInferValidatorInput<Type extends Record<PropertyKey, unknown>> =
	{
		[Key in keyof Type]: Cudenix.InferValidatorInput<Type[Key]>;
	};

/**
 * Map every value of a per-slot schema record to its inferred output shape.
 *
 * Counterpart of {@link DeepInferValidatorInput}. Each value flows through
 * `Cudenix.InferValidatorOutput`, which extracts the post-validation type a
 * schema produces. Used by `Module.validator` and `Module.route` to populate
 * the `outputs` half of a module's validator dictionary, so route handlers
 * see the parsed request shape with schema-level transformations already
 * applied.
 *
 * @typeParam Type - Record mapping {@link ValidatorRequest} slot names to
 *   the schema declared for each.
 * @example
 * ```typescript
 * type A = DeepInferValidatorOutput<{
 *   body: StandardSchemaV1<{ raw: string }, { parsed: number }>;
 *   query: { page: number };
 * }>;
 * // { body: { parsed: number }; query: { page: number } }
 *
 * type B = DeepInferValidatorOutput<{ params: { id: string } }>;
 * // { params: { id: string } }
 * ```
 */
export type DeepInferValidatorOutput<
	Type extends Record<PropertyKey, unknown>,
> = {
	[Key in keyof Type]: Cudenix.InferValidatorOutput<Type[Key]>;
};

/**
 * Resolve to the discriminated union of per-slot error wrappers.
 *
 * For every key in `Type`, the mapped step produces an entry shaped
 * `{ details: [Type[Key]]; type: Key }`; indexing by `keyof Type` folds
 * those entries into a single union discriminated by `type`. Consumers can
 * narrow on `type` to recover the matching `details` payload at compile
 * time.
 *
 * @typeParam Type - Record whose keys become the discriminant and whose
 *   values become the wrapped detail payload.
 * @example
 * ```typescript
 * type A = ValidatorErrorDetails<{
 *   body: BodyIssue[];
 *   query: QueryIssue[];
 * }>;
 * // | { details: [BodyIssue[]]; type: "body" }
 * // | { details: [QueryIssue[]]; type: "query" }
 * ```
 */
export type ValidatorErrorDetails<Type> = {
	[Key in keyof Type]: { details: [Type[Key]]; type: Key };
}[keyof Type];

/**
 * Wrap a per-slot error dictionary in the canonical 422 envelope.
 *
 * Produces the one-entry record
 * `{ 422: Error<[{ details: [union] }], 422> }`, where the inner union is
 * the {@link ValidatorErrorDetails} of `ValidatorError`. The module and
 * route compilers fold this entry into the surrounding error dictionary
 * via `MergeErrors`, so a failed validation surfaces alongside any other
 * 4xx/5xx a handler can emit.
 *
 * The type-level `content` is a 1-tuple containing a single discriminated
 * entry, expressing the *shape* of one failed slot. At runtime,
 * `processValidators` writes a multi-entry array — one entry per slot
 * that actually failed — into the 422 envelope, so consumers reading the
 * payload should iterate it rather than relying on the tuple length.
 *
 * @typeParam ValidatorError - Record produced by
 *   {@link DeepInferValidatorError}, mapping slot names to their inferred
 *   error type.
 * @example
 * ```typescript
 * type A = TransformValidatorError<{
 *   body: BodyIssue[];
 *   query: QueryIssue[];
 * }>;
 * // {
 * //   422: Error<
 * //     [{
 * //       details: [
 * //         | { details: [BodyIssue[]]; type: "body" }
 * //         | { details: [QueryIssue[]]; type: "query" }
 * //       ];
 * //     }],
 * //     422
 * //   >;
 * // }
 * ```
 */
export interface TransformValidatorError<
	ValidatorError extends Record<PropertyKey, unknown>,
> {
	422: Error<[{ details: [ValidatorErrorDetails<ValidatorError>] }], 422>;
}

/**
 * Combine two slot-keyed validator-request shapes, letting `SecondType`
 * override `FirstType` unless its entry is left as `unknown`.
 *
 * The mapped type iterates over the fixed slot vocabulary
 * `body | cookies | headers | params | query`. For each slot:
 *
 * - The key is dropped entirely when both operands carry `unknown` — the
 *   slot was never declared on either side, so it stays absent from the
 *   merged result.
 * - The value is taken from `SecondType` when it is concrete (not
 *   `unknown`), overriding whatever `FirstType` contributed.
 * - Otherwise the value falls back to `FirstType`'s slot.
 *
 * The `[unknown] extends [Type[Key]]` tuple wrapping suppresses the
 * implicit distribution that conditional types perform over naked union
 * operands, so a slot typed as `unknown | T` is treated as a single shape
 * rather than splitting member-by-member. Used by `Module.extends`,
 * `Module.route`, and nested validators so the most recent declaration
 * shadows the accumulated one without losing slots that the new layer
 * leaves untouched.
 *
 * @typeParam FirstType - Accumulated validator shape so far.
 * @typeParam SecondType - Newly contributed validator shape; concrete
 *   slots override `FirstType`, `unknown` slots defer to it.
 * @example
 * ```typescript
 * type A = MergeInferValidatorRequest<
 *   { body: { id: string }; query: unknown },
 *   { body: unknown;        query: { page: number } }
 * >;
 * // { body: { id: string }; query: { page: number } }
 * ```
 */
export type MergeInferValidatorRequest<
	FirstType extends Record<PropertyKey, unknown>,
	SecondType extends Record<PropertyKey, unknown>,
> = {
	[Key in "body" | "cookies" | "headers" | "params" | "query" as [
		unknown,
	] extends [SecondType[Key]]
		? [unknown] extends [FirstType[Key]]
			? never
			: Key
		: Key]: [unknown] extends [SecondType[Key]]
		? FirstType[Key]
		: SecondType[Key];
};

/**
 * Fixed dictionary of the five request slots that validators can target.
 *
 * Each generic parameter pins the type of the corresponding slot — `body`,
 * `cookies`, `headers`, `params`, `query` — and defaults to `unknown` so
 * callers fill only the slots they actually validate. The literal key set
 * is reused by the runtime as the canonical slot vocabulary:
 * `processValidators` indexes `context.request` with
 * `keyof ValidatorRequest`, and `Module.prototype.validator` /
 * `Module.prototype.route` snapshot `Object.keys(options.request)` as
 * `(keyof ValidatorRequest)[]`.
 *
 * @typeParam Body - Type of the validated request body.
 * @typeParam Cookies - Type of the validated cookie bag.
 * @typeParam Headers - Type of the validated header bag.
 * @typeParam Params - Type of the validated path-parameter dictionary.
 * @typeParam Query - Type of the validated query-string dictionary.
 * @example
 * ```typescript
 * type A = ValidatorRequest;
 * // { body: unknown; cookies: unknown; headers: unknown; params: unknown; query: unknown }
 *
 * type B = ValidatorRequest<
 *   { id: string },
 *   unknown,
 *   unknown,
 *   unknown,
 *   { page: number }
 * >;
 * // { body: { id: string }; cookies: unknown; headers: unknown; params: unknown; query: { page: number } }
 *
 * type C = keyof ValidatorRequest;
 * // "body" | "cookies" | "headers" | "params" | "query"
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
 * Runtime descriptor for an attached validator chain link.
 *
 * Produced by `Module.prototype.validator` and `Module.prototype.route`
 * when they snapshot the user-supplied {@link ValidatorOptions}. `keys` is
 * the cached list of `request`'s own property names, narrowed to
 * {@link ValidatorRequest}'s slot vocabulary so `processValidators` can
 * walk the schema map without revisiting `Object.keys`. `type` is the
 * `"VALIDATOR"` discriminant the compile pass and `processValidators`
 * switch on to dispatch validator links from the chain.
 *
 * @typeParam Request - Partial {@link ValidatorRequest} listing the
 *   schemas the caller actually declared.
 * @example
 * ```typescript
 * type A = Validator<{ body: { id: string } }>;
 * // {
 * //   keys: ("body" | "cookies" | "headers" | "params" | "query")[];
 * //   request: { body: { id: string } };
 * //   type: "VALIDATOR";
 * // }
 *
 * type B = A["type"];
 * // "VALIDATOR"
 * ```
 */
export interface Validator<Request extends Partial<ValidatorRequest>> {
	keys: (keyof ValidatorRequest)[];
	request: Request;
	type: "VALIDATOR";
}

/**
 * Convenience alias matching any {@link Validator} regardless of the
 * request parameter.
 *
 * Reach for it in container or registry types where the concrete schema
 * shape is irrelevant — for example, the `link` typed `chain` walked by
 * `processValidators`, which dispatches by `type` rather than by generic.
 *
 * @example
 * ```typescript
 * type A = AnyValidator;
 * // Validator<any>
 *
 * type B = Validator<{ body: { id: string } }> extends AnyValidator ? true : false;
 * // true
 *
 * type C = AnyValidator["type"];
 * // "VALIDATOR"
 * ```
 */
export type AnyValidator = Validator<any>;

/**
 * Options accepted by `Module.prototype.validator` and
 * `RouteOptions.validator`.
 *
 * The single `request` field maps slot names to their schemas; the runtime
 * later snapshots `Object.keys(request)` into a {@link Validator}
 * descriptor and stores the original map on `request` for plugin lookup.
 * Wrapped in its own interface so consumers can constrain or extend it
 * through a `_ValidatorOptions` generic without recreating the field by
 * hand.
 *
 * @typeParam Request - Partial {@link ValidatorRequest} listing which
 *   slots the caller wants validated and the schema declared for each.
 * @example
 * ```typescript
 * type A = ValidatorOptions<{
 *   body: { id: string };
 *   query: { page: number };
 * }>;
 * // { request: { body: { id: string }; query: { page: number } } }
 *
 * type B = ValidatorOptions<{ params: { id: string } }>["request"];
 * // { params: { id: string } }
 * ```
 */
export interface ValidatorOptions<Request extends Partial<ValidatorRequest>> {
	request: Request;
}

/**
 * Convenience alias matching any {@link ValidatorOptions} regardless of
 * the request parameter.
 *
 * Reach for it where the concrete schema shape is erased — for example,
 * the `options` argument of the `Module.prototype.validator` runtime
 * implementation, which destructured `request` without caring about its
 * generic.
 *
 * @example
 * ```typescript
 * type A = AnyValidatorOptions;
 * // ValidatorOptions<any>
 *
 * type B = ValidatorOptions<{ body: { id: string } }> extends AnyValidatorOptions
 *   ? true
 *   : false;
 * // true
 *
 * type C = AnyValidatorOptions["request"];
 * // any
 * ```
 */
export type AnyValidatorOptions = ValidatorOptions<any>;
