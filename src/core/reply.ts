import { FrozenEmpty } from "@/utils/objects/empty";
import type { ExtractContent } from "@/utils/types/extract-content";

/**
 * @module
 * Response envelope (`Reply`) shared by the success and error directions, the
 * `ok` / `fail` factories that build it, and the type-level utilities that
 * filter, exclude, transform, and merge status-keyed envelope dictionaries.
 */

/**
 * Response envelope returned by middlewares, stores, validators, and route
 * handlers. `success` is the discriminant that splits the success direction
 * from the error direction without inspecting the status code; the runtime
 * reads `content` and `status` when serializing the response.
 *
 * Build one with the {@link ok} / {@link fail} factories rather than the raw
 * constructor; {@link Error} and {@link Success} are the directional aliases.
 *
 * @typeParam Content - Type of the payload supplied to the factory. At the
 *   type level it flows through {@link ExtractContent}, so a function-typed
 *   `Content` is reported as its awaited return type even though the payload
 *   is stored verbatim at runtime.
 * @typeParam Status - Numeric literal type of the response status code.
 *   Defaults to `200`.
 * @typeParam Ok - Boolean literal discriminant. Defaults to `true`.
 * @example
 * ```typescript
 * const a: Reply<{ a: "v1" }, 200, true> = {
 *   content: { a: "v1" },
 *   status: 200,
 *   success: true,
 * };
 * ```
 */
export interface Reply<
	Content,
	Status extends number = 200,
	Ok extends boolean = true,
> {
	content: ExtractContent<Content>;
	status: Status;
	success: Ok;
}

/**
 * Wildcard alias matching any {@link Reply} regardless of content, status, or
 * discriminant. Reach for it in container or registry types where the concrete
 * generics are irrelevant — for example the union threaded through the
 * directional filters or the envelopes walked by the module compiler.
 *
 * @example
 * ```typescript
 * const a: AnyReply = ok({ a: "v1" });
 *
 * a.status; // 200
 * ```
 */
export type AnyReply = Reply<any, any, any>;

/**
 * Error direction of a {@link Reply} — fixes the discriminant to `false` and
 * defaults the status to `400`. Returned by handlers to signal a failed
 * response; build one with {@link fail}.
 *
 * @typeParam Content - Payload type; see {@link Reply}.
 * @typeParam Status - Numeric literal status code. Defaults to `400`.
 * @example
 * ```typescript
 * const a: Error<{ a: "v1" }, 400> = {
 *   content: { a: "v1" },
 *   status: 400,
 *   success: false,
 * };
 * ```
 */
export type Error<Content, Status extends number = 400> = Reply<
	Content,
	Status,
	false
>;

/**
 * Success direction of a {@link Reply} — fixes the discriminant to `true` and
 * defaults the status to `200`. Returned by handlers to signal a successful
 * response; build one with {@link ok}.
 *
 * @typeParam Content - Payload type; see {@link Reply}.
 * @typeParam Status - Numeric literal status code. Defaults to `200`.
 * @example
 * ```typescript
 * const a: Success<{ a: "v1" }, 200> = {
 *   content: { a: "v1" },
 *   status: 200,
 *   success: true,
 * };
 * ```
 */
export type Success<Content, Status extends number = 200> = Reply<
	Content,
	Status,
	true
>;

/**
 * Wildcard alias matching any error-direction {@link Reply} (`success: false`)
 * regardless of content or status. Reach for it where the concrete generics
 * are erased — for example the union threaded through {@link FilterError} or
 * the error-tagged returns walked by the module compiler.
 *
 * @example
 * ```typescript
 * const a: AnyError = fail({ a: "v1" });
 *
 * a.success; // false
 * ```
 */
export type AnyError = Reply<any, any, false>;

/**
 * Wildcard alias matching any success-direction {@link Reply} (`success: true`)
 * regardless of content or status. Reach for it where the concrete generics
 * are erased — for example the union threaded through {@link FilterSuccess} or
 * the success-tagged returns walked by the module compiler.
 *
 * @example
 * ```typescript
 * const a: AnySuccess = ok({ a: "v1" });
 *
 * a.success; // true
 * ```
 */
export type AnySuccess = Reply<any, any, true>;

/**
 * Pick every {@link AnyError}-shaped member out of `T`. Use it to isolate the
 * error half of a handler's return union before the module compiler folds it
 * into the parent's error dictionary.
 *
 * Thin wrapper over the builtin `Extract<T, AnyError>` — members that are not
 * assignable to {@link AnyError} are discarded.
 *
 * @typeParam T - Union to filter.
 * @example
 * ```typescript
 * type A = FilterError<Error<"v1", 400> | Success<"v2", 200>>;
 * // Error<"v1", 400>
 * ```
 */
export type FilterError<T> = Extract<T, AnyError>;

/**
 * Pick every {@link AnySuccess}-shaped member out of `T`. Use it to isolate the
 * success half of a handler's return union before the module compiler folds it
 * into the parent's success dictionary.
 *
 * Thin wrapper over the builtin `Extract<T, AnySuccess>` — members that are not
 * assignable to {@link AnySuccess} are discarded.
 *
 * @typeParam T - Union to filter.
 * @example
 * ```typescript
 * type A = FilterSuccess<Success<"v1", 200> | Error<"v2", 400>>;
 * // Success<"v1", 200>
 * ```
 */
export type FilterSuccess<T> = Extract<T, AnySuccess>;

/**
 * Drop every {@link AnyError}-shaped member from `T`, keeping the non-error
 * branches intact. Mirror of {@link FilterError} — the module compiler reaches
 * for this when it needs the store side of a return union separated from the
 * error envelopes that halt the chain.
 *
 * Thin wrapper over the builtin `Exclude<T, AnyError>`.
 *
 * @typeParam T - Union to filter.
 * @example
 * ```typescript
 * type A = IgnoreError<Error<"v1", 400> | Success<"v2", 200>>;
 * // Success<"v2", 200>
 * ```
 */
export type IgnoreError<T> = Exclude<T, AnyError>;

/**
 * Drop every {@link AnySuccess}-shaped member from `T`, keeping the non-success
 * branches intact. Mirror of {@link FilterSuccess} — isolates the error side of
 * a return union by discarding the success envelopes.
 *
 * Thin wrapper over the builtin `Exclude<T, AnySuccess>`.
 *
 * @typeParam T - Union to filter.
 * @example
 * ```typescript
 * type A = IgnoreSuccess<Success<"v1", 200> | Error<"v2", 400>>;
 * // Error<"v2", 400>
 * ```
 */
export type IgnoreSuccess<T> = Exclude<T, AnySuccess>;

/**
 * Re-key a single {@link AnyError} by its `status` code, producing the
 * one-entry record `{ [T["status"]]: T }`. Used by the module compiler so the
 * per-module error map stays deduplicated when two units emit the same status.
 *
 * @typeParam T - Error envelope whose `status` becomes the dictionary key.
 * @example
 * ```typescript
 * type A = TransformError<Error<"v1", 400>>;
 * // { 400: Error<"v1", 400> }
 * ```
 */
export type TransformError<T extends AnyError> = Record<T["status"], T>;

/**
 * Re-key a single {@link AnySuccess} by its `status` code, producing the
 * one-entry record `{ [T["status"]]: T }`. Used by the module compiler so the
 * per-module success map stays deduplicated when two units emit the same
 * status.
 *
 * @typeParam T - Success envelope whose `status` becomes the dictionary key.
 * @example
 * ```typescript
 * type A = TransformSuccess<Success<"v1", 200>>;
 * // { 200: Success<"v1", 200> }
 * ```
 */
export type TransformSuccess<T extends AnySuccess> = Record<T["status"], T>;

type MergeReplies<T extends object, U extends object> = {
	[K in keyof T | keyof U]: K extends keyof T
		? K extends keyof U
			? {
					[K2 in keyof T[K] | keyof U[K]]: K2 extends keyof T[K]
						? K2 extends keyof U[K]
							? T[K][K2] | U[K][K2]
							: T[K][K2]
						: K2 extends keyof U[K]
							? U[K][K2]
							: never;
				}
			: T[K]
		: K extends keyof U
			? U[K]
			: never;
};

/**
 * Deeply merge two status-keyed error dictionaries. Reached for by
 * `module.middleware`, `module.mount`, `module.route`, `module.store`, and
 * `module.validator` to accumulate the error shapes contributed by each unit
 * without dropping any branch.
 *
 * For every status present in only one operand the value is taken verbatim.
 * When both operands carry an entry under the same status the inner
 * per-property values are merged one level deeper: shared keys receive the
 * union of the two value types, exclusive keys pass through unchanged.
 *
 * @typeParam T - Accumulated error dictionary so far.
 * @typeParam U - Dictionary contributed by the new unit, merged into `T`.
 * @example
 * ```typescript
 * type A = MergeErrors<
 *   { 400: { content: ["a"]; status: 400; success: false } },
 *   { 400: { content: ["b"]; status: 400; success: false } }
 * >;
 * // { 400: { content: ["a"] | ["b"]; status: 400; success: false } }
 * ```
 */
export type MergeErrors<T extends object, U extends object> = MergeReplies<
	T,
	U
>;

/**
 * Deeply merge two status-keyed success dictionaries. Reached for by
 * `module.middleware` and `module.mount` to accumulate the success shapes
 * contributed by each unit without dropping any branch.
 *
 * For every status present in only one operand the value is taken verbatim.
 * When both operands carry an entry under the same status the inner
 * per-property values are merged one level deeper: shared keys receive the
 * union of the two value types, exclusive keys pass through unchanged.
 *
 * @typeParam T - Accumulated success dictionary so far.
 * @typeParam U - Dictionary contributed by the new unit, merged into `T`.
 * @example
 * ```typescript
 * type A = MergeSuccesses<
 *   { 200: { content: ["a"]; status: 200; success: true } },
 *   { 200: { content: ["b"]; status: 200; success: true } }
 * >;
 * // { 200: { content: ["a"] | ["b"]; status: 200; success: true } }
 * ```
 */
export type MergeSuccesses<T extends object, U extends object> = MergeReplies<
	T,
	U
>;

/**
 * Options accepted by the {@link ok} / {@link fail} factories. The `Status`
 * parameter threads the literal status code through the type system so the
 * resulting envelope keeps its narrow `status` literal instead of widening to
 * `number`.
 *
 * @typeParam Status - Numeric literal type of the response status code.
 * @example
 * ```typescript
 * const a: ReplyOptions<401> = { status: 401 };
 *
 * fail({ a: 1 }, a); // Error<{ a: 1 }, 401>
 * ```
 */
export interface ReplyOptions<Status extends number = number> {
	status?: Status;
}

/**
 * Wildcard alias matching any {@link ReplyOptions} regardless of the status
 * parameter. Reach for it where the concrete status is erased — for example a
 * helper that destructures `status` without caring about its literal type.
 *
 * @example
 * ```typescript
 * const fn = ({ status = 200 }: AnyReplyOptions) => status;
 *
 * fn({ status: 201 }); // 201
 * fn({}); // 200
 * ```
 */
export type AnyReplyOptions = ReplyOptions<any>;

/**
 * Constructor signature of the low-level {@link Reply} value, declared
 * separately so the runtime value can be defined with a plain `function` and
 * cast to a constructable type. Prefer {@link ok} / {@link fail} over invoking
 * it directly.
 *
 * @example
 * ```typescript
 * const Ctor: ReplyConstructor = Reply;
 *
 * const a = new Ctor("v1", { status: 401, success: false });
 *
 * a.success; // false
 * ```
 */
export interface ReplyConstructor {
	new <const Content, const Status extends number, const Ok extends boolean>(
		content: Content,
		options: { status: Status; success: Ok },
	): Reply<Content, Status, Ok>;
}

/**
 * Low-level constructor for a {@link Reply} envelope. Must be invoked with
 * `new`; assigns `content`, `status`, and `success` verbatim — the runtime
 * reads `content` and `status` when serializing the response, while
 * `success` is the discriminant the dispatcher reads to tell the error
 * direction apart. Prefer the {@link ok} / {@link fail} factories, which
 * bind the discriminant and a sensible default status.
 *
 * @param content - Payload assigned to `this.content` verbatim.
 * @param options - Explicit `status` code and `success` discriminant.
 * @example
 * ```typescript
 * const a = new Reply("v1", { status: 200, success: true });
 *
 * a.content; // "v1"
 * a.success; // true
 * ```
 */
export const Reply = function Reply(
	this: AnyReply,
	content: unknown,
	{ status, success }: { status: number; success: boolean },
) {
	this.content = content;
	this.status = status;
	this.success = success;
} as unknown as ReplyConstructor;

type OkFactory = <const Content, const Status extends number = 200>(
	content: Content,
	options?: ReplyOptions<Status>,
) => Success<Content, Status>;

type FailFactory = <const Content, const Status extends number = 400>(
	content: Content,
	options?: ReplyOptions<Status>,
) => Error<Content, Status>;

/**
 * Construct a success-direction {@link Reply} ({@link Success}) from a payload
 * and an optional status code. `status` defaults to `200`; {@link FrozenEmpty}
 * is the default options object, so the no-argument path skips a fresh `{}`
 * allocation. The type-level {@link ExtractContent} unwrapping is not mirrored
 * at runtime — a function-typed `content` is stored as-is.
 *
 * @param content - Payload assigned to `content` verbatim.
 * @param options - Optional behavior switches; see {@link ReplyOptions}.
 * @example
 * ```typescript
 * const a = ok({ a: "v1" });
 *
 * a.status;  // 200
 * a.success; // true
 *
 * const b = ok({ a: 1 }, { status: 201 });
 *
 * b.status; // 201
 * ```
 */
export const ok = ((
	content: unknown,
	{ status = 200 }: AnyReplyOptions = FrozenEmpty,
) => new Reply(content, { status, success: true })) as unknown as OkFactory;

/**
 * Construct an error-direction {@link Reply} ({@link Error}) from a payload and
 * an optional status code. `status` defaults to `400`; {@link FrozenEmpty} is
 * the default options object, so the no-argument path skips a fresh `{}`
 * allocation. The type-level {@link ExtractContent} unwrapping is not mirrored
 * at runtime — a function-typed `content` is stored as-is.
 *
 * @param content - Payload assigned to `content` verbatim.
 * @param options - Optional behavior switches; see {@link ReplyOptions}.
 * @example
 * ```typescript
 * const a = fail({ a: "v1" });
 *
 * a.status;  // 400
 * a.success; // false
 *
 * const b = fail({ a: 1 }, { status: 401 });
 *
 * b.status; // 401
 * ```
 */
export const fail = ((
	content: unknown,
	{ status = 400 }: AnyReplyOptions = FrozenEmpty,
) => new Reply(content, { status, success: false })) as unknown as FailFactory;
