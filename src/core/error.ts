import type { ExtractContent } from "@/types/extract-content";
import { FrozenEmpty } from "@/utils/objects/empty";

/**
 * @module
 * Error envelope plus the type-level utilities that filter, exclude,
 * transform, and merge error dictionaries.
 */

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
 * type A = FilterError<Error<"v1", 400> | { a: "v2" }>;
 * // Error<"v1", 400>
 * ```
 */
export type FilterError<T> = Extract<T, AnyError>;

/**
 * Drop every {@link AnyError}-shaped member from `T`, keeping the non-error
 * branches intact. Mirrors {@link FilterError} — the module compiler reaches
 * for this when it needs the success or store side of a return union
 * separated from the error envelopes that halt the chain.
 *
 * Thin wrapper over the builtin `Exclude<T, AnyError>`.
 *
 * @typeParam T - Union to filter.
 * @example
 * ```typescript
 * type A = IgnoreError<Error<"v1", 400> | { a: "v2" }>;
 * // { a: "v2" }
 * ```
 */
export type IgnoreError<T> = Exclude<T, AnyError>;

/**
 * Re-key a single {@link AnyError} by its `status` code, producing the
 * one-entry record `{ [T["status"]]: T }`. Used by the module compiler so the
 * per-module error map stays deduplicated when two units emit the same
 * status.
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
 * Deeply merge two status-keyed error dictionaries. Reached for by
 * `Module.extends`, `Module.middleware`, `Module.route`, `Module.store`, and
 * `Module.validator` to accumulate the error shapes contributed by each unit
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
export type MergeErrors<T extends object, U extends object> = {
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

interface ErrorOptions<Status extends number> {
	status?: Status;
}

type AnyErrorOptions = ErrorOptions<any>;

/**
 * Error envelope returned by middlewares, stores, validators, and route
 * handlers to signal a failure response. `success: false` is the discriminant
 * that lets the runtime tell errors apart from `Success` values without
 * inspecting the status code.
 *
 * @typeParam Content - Type of the payload supplied to the constructor. At
 *   the type level it flows through {@link ExtractContent}, so a
 *   function-typed `Content` is reported as its awaited return type even
 *   though the constructor stores the function verbatim at runtime.
 * @typeParam Status - Numeric literal type of the response status code.
 *   Defaults to `400`.
 * @example
 * ```typescript
 * const a: Error<{ a: "v1" }, 400> = {
 *   content: { a: "v1" },
 *   status: 400,
 *   success: false,
 * };
 * ```
 */
export interface Error<Content, Status extends number = 400> {
	content: ExtractContent<Content>;
	status: Status;
	success: false;
}

/**
 * Convenience alias matching any {@link Error} regardless of content or
 * status parameters. Reach for it in container or registry types where the
 * concrete generics are irrelevant — for example, the union threaded through
 * {@link FilterError} or the error-tagged returns walked by the module
 * compiler.
 *
 * @example
 * ```typescript
 * const a: AnyError = new Error({ a: "v1" });
 *
 * a.status; // 400
 * a.success; // false
 * ```
 */
export type AnyError = Error<any, any>;

/**
 * Constructor signature of {@link Error}, declared separately so the runtime
 * value can be defined with a plain `function` and cast to a constructable
 * type.
 *
 * @example
 * ```typescript
 * const Ctor: ErrorConstructor = Error;
 *
 * const a = new Ctor({ a: "v1" }, { status: 401 });
 *
 * a.status; // 401
 * ```
 */
export interface ErrorConstructor {
	new <const Content, const Status extends number = 400>(
		content: Content,
		options?: ErrorOptions<Status>,
	): Error<Content, Status>;
}

/**
 * Construct an {@link Error} envelope from a content payload and an optional
 * status code. Must be invoked with `new`; the resulting instance carries
 * `content`, `status`, and `success: false` — the three fields the runtime
 * reads when serializing the response.
 *
 * `status` defaults to `400` when `options` is omitted; {@link FrozenEmpty}
 * is the default options object, so the no-argument path skips a fresh `{}`
 * allocation. The interface's type-level {@link ExtractContent} unwrapping is
 * not mirrored at runtime — a function-typed `content` is stored as-is.
 *
 * @param content - Payload assigned to `this.content` verbatim.
 * @param options - Optional behavior switches; `status` falls back to `400`.
 * @example
 * ```typescript
 * const a = new Error({ a: "v1" });
 *
 * a.content; // { a: "v1" }
 * a.status;  // 400
 * a.success; // false
 *
 * const b = new Error("v2", { status: 401 });
 *
 * b.status; // 401
 * ```
 */
export const Error = function Error(
	this: AnyError,
	content: unknown,
	{ status = 400 }: AnyErrorOptions = FrozenEmpty,
) {
	this.content = content;
	this.status = status;
	this.success = false;
} as unknown as ErrorConstructor;
