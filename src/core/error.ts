import type { ExtractContent } from "@/types/extract-content";
import { FrozenEmpty } from "@/utils/objects/empty";

/**
 * @module
 * Error envelope: typed failure value returned by handlers, plus the
 * type-level utilities used to filter, transform and merge error
 * dictionaries throughout the framework.
 */

/**
 * Pick every {@link AnyError}-shaped member out of `Type`.
 *
 * Thin wrapper over the builtin `Extract<Type, AnyError>`. Used by the
 * module compiler to isolate the error half of a handler return type
 * before folding it into the parent's error dictionary, while its
 * counterpart {@link IgnoreError} keeps the non-error half.
 *
 * @typeParam Type - Union to filter. Members that are not assignable to
 *   {@link AnyError} are discarded.
 * @example
 * ```typescript
 * type A = FilterError<Error<"oops", 500> | Success<"ok", 200>>;
 * // Error<"oops", 500>
 * ```
 */
export type FilterError<Type> = Extract<Type, AnyError>;

/**
 * Strip every {@link AnyError}-shaped member out of `Type`.
 *
 * Thin wrapper over the builtin `Exclude<Type, AnyError>`. Counterpart of
 * {@link FilterError}: used by `Module.store` to keep only the non-error
 * keys a store contributes to `context.store`, since error returns
 * short-circuit the chain and never reach the store dictionary.
 *
 * @typeParam Type - Union to filter. Members assignable to
 *   {@link AnyError} are discarded.
 * @example
 * ```typescript
 * type A = IgnoreError<{ user: User } | Error<"unauthorized", 401>>;
 * // { user: User }
 * ```
 */
export type IgnoreError<Type> = Exclude<Type, AnyError>;

/**
 * Re-index a single {@link AnyError} by its `status` code.
 *
 * Produces the one-entry record `{ [Error["status"]]: Error }` that the
 * module compiler accumulates into the error dictionary attached to each
 * module. Keying by status keeps the per-module map deduplicated when two
 * units happen to emit the same status.
 *
 * @typeParam Error - Error envelope whose `status` becomes the dictionary
 *   key.
 * @example
 * ```typescript
 * type A = TransformError<Error<"oops", 500>>;
 * // { 500: Error<"oops", 500> }
 * ```
 */
export type TransformError<Error extends AnyError> = Record<
	Error["status"],
	Error
>;

/**
 * Deeply merge two status-keyed error dictionaries.
 *
 * For every status that exists in only one operand the value is taken
 * verbatim. When both operands carry an entry under the same status the
 * inner per-property entries are merged at the next level: shared keys
 * receive the union of the two value types, exclusive keys pass through
 * unchanged. Used by `Module.extends`, `Module.middleware`, `Module.route`,
 * `Module.store`, and `Module.validator` to accumulate the error shapes
 * contributed by each unit without dropping any branch.
 *
 * @typeParam Errors - Accumulated error dictionary so far.
 * @typeParam Error - Dictionary contributed by the new unit, merged into
 *   `Errors`.
 * @example
 * ```typescript
 * type A = MergeErrors<
 *   { 400: { content: ["a"]; status: 400; success: false } },
 *   { 400: { content: ["b"]; status: 400; success: false } }
 * >;
 * // { 400: { content: ["a"] | ["b"]; status: 400; success: false } }
 * ```
 */
export type MergeErrors<Errors, Error> = {
	[Key in keyof Errors | keyof Error]: Key extends keyof Errors
		? Key extends keyof Error
			? {
					[Key2 in
						| keyof Errors[Key]
						| keyof Error[Key]]: Key2 extends keyof Errors[Key]
						? Key2 extends keyof Error[Key]
							? Errors[Key][Key2] | Error[Key][Key2]
							: Errors[Key][Key2]
						: Key2 extends keyof Error[Key]
							? Error[Key][Key2]
							: never;
				}
			: Errors[Key]
		: Key extends keyof Error
			? Error[Key]
			: never;
};

/**
 * Internal options accepted by the {@link Error} constructor.
 *
 * The `Status` parameter carries the literal status code through the type
 * system so the resulting envelope keeps its narrow `status` literal
 * instead of widening to `number`. The constructor defaults the field to
 * `400` when omitted.
 *
 * @typeParam Status - Numeric literal type of the response status code.
 */
interface ErrorOptions<Status extends number> {
	status?: Status;
}

/**
 * Convenience alias matching any {@link ErrorOptions} regardless of the
 * status parameter.
 *
 * Reach for it where the concrete status is erased — for example, the
 * options argument of the {@link Error} constructor, which destructures
 * `status` without caring about its literal type.
 */
type AnyErrorOptions = ErrorOptions<any>;

/**
 * Error envelope returned by middlewares, stores, validators, and route
 * handlers to signal a failure.
 *
 * `success: false` is the discriminant that lets the runtime — and any
 * caller of the framework — tell errors apart from `Success` values
 * without inspecting the status code. `status` keeps the literal HTTP
 * status of the response, defaulting to `400`. `content` is the payload
 * supplied to the constructor.
 *
 * @typeParam Content - Type of the payload supplied to the constructor.
 *   At the type level it flows through {@link ExtractContent}, so a
 *   function-typed `Content` is reported as its awaited return type
 *   even though the constructor stores the function verbatim at runtime.
 * @typeParam Status - Numeric literal type of the response status code.
 *   Defaults to `400`.
 */
export interface Error<Content, Status extends number = 400> {
	content: ExtractContent<Content>;
	status: Status;
	success: false;
}

/**
 * Convenience alias matching any {@link Error} regardless of content or
 * status parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, the union threaded through
 * {@link FilterError}, {@link IgnoreError}, and the error-tagged returns
 * walked by the module compiler.
 */
export type AnyError = Error<any, any>;

/**
 * Constructor signature of {@link Error}, declared separately so the
 * value can be defined with a plain `function` and cast to a constructable
 * type.
 */
interface Constructor {
	new <const Content, const Status extends number = 400>(
		content: Content,
		options?: ErrorOptions<Status>,
	): Error<Content, Status>;
}

/**
 * Construct an {@link Error} envelope from a content payload and an
 * optional status code.
 *
 * Invoked through `new`. Writes `content`, `status`, and `success: false`
 * onto `this` so the resulting instance carries the three fields the
 * runtime reads when serializing the response. `status` defaults to `400`
 * when `options` is omitted; the destructuring uses {@link FrozenEmpty}
 * as the default options object to avoid allocating a fresh `{}` on every
 * call.
 *
 * @param content - Payload assigned to `this.content` verbatim. Note that
 *   the interface's type-level {@link ExtractContent} unwrapping is not
 *   mirrored at runtime: a function-typed argument is stored as-is.
 * @param options - Optional behavior switches; see {@link ErrorOptions}.
 * @example
 * ```typescript
 * const notFound = new Error("user not found", { status: 404 });
 *
 * notFound.content; // "user not found"
 * notFound.status;  // 404
 * notFound.success; // false
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
} as unknown as Constructor;
