import type { ExtractContent } from "@/types/extract-content";
import { FrozenEmpty } from "@/utils/objects/empty";

/**
 * @module
 * Success envelope: typed success value returned by handlers, plus the
 * type-level utilities used to filter, transform and merge success
 * dictionaries throughout the framework.
 */

/**
 * Pick every {@link AnySuccess}-shaped member out of `Type`.
 *
 * Thin wrapper over the builtin `Extract<Type, AnySuccess>`. Used by the
 * module compiler to isolate the success half of a handler return type
 * before folding it into the parent's success dictionary, complementing
 * `FilterError` which keeps the error half of the same union.
 *
 * @typeParam Type - Union to filter. Members that are not assignable to
 *   {@link AnySuccess} are discarded.
 * @example
 * ```typescript
 * type A = FilterSuccess<Success<"v1", 1> | Error<"v2", 2>>;
 * // Success<"v1", 1>
 * ```
 */
export type FilterSuccess<Type> = Extract<Type, AnySuccess>;

/**
 * Re-index a single {@link AnySuccess} by its `status` code.
 *
 * Produces the one-entry record `{ [Success["status"]]: Success }` that the
 * module compiler accumulates into the success dictionary attached to each
 * module. Keying by status keeps the per-module map deduplicated when two
 * units happen to emit the same status.
 *
 * @typeParam Success - Success envelope whose `status` becomes the
 *   dictionary key.
 * @example
 * ```typescript
 * type A = TransformSuccess<Success<{ a: string }, 1>>;
 * // { 1: Success<{ a: string }, 1> }
 * ```
 */
export type TransformSuccess<Success extends AnySuccess> = Record<
	Success["status"],
	Success
>;

/**
 * Deeply merge two status-keyed success dictionaries.
 *
 * For every status that exists in only one operand the value is taken
 * verbatim. When both operands carry an entry under the same status the
 * inner per-property entries are merged at the next level: shared keys
 * receive the union of the two value types, exclusive keys pass through
 * unchanged. Used by `Module.extends`, `Module.middleware`, `Module.route`,
 * `Module.store`, and `Module.validator` to accumulate the success shapes
 * contributed by each unit without dropping any branch.
 *
 * @typeParam Successes - Accumulated success dictionary so far.
 * @typeParam Success - Dictionary contributed by the new unit, merged into
 *   `Successes`.
 * @example
 * ```typescript
 * type A = MergeSuccesses<
 *   { 1: { content: ["v1"]; status: 1; success: true } },
 *   { 1: { content: ["v2"]; status: 1; success: true } }
 * >;
 * // { 1: { content: ["v1"] | ["v2"]; status: 1; success: true } }
 * ```
 */
export type MergeSuccesses<Successes, Success> = {
	[Key in keyof Successes | keyof Success]: Key extends keyof Successes
		? Key extends keyof Success
			? {
					[Key2 in
						| keyof Successes[Key]
						| keyof Success[Key]]: Key2 extends keyof Successes[Key]
						? Key2 extends keyof Success[Key]
							? Successes[Key][Key2] | Success[Key][Key2]
							: Successes[Key][Key2]
						: Key2 extends keyof Success[Key]
							? Success[Key][Key2]
							: never;
				}
			: Successes[Key]
		: Key extends keyof Success
			? Success[Key]
			: never;
};

/**
 * Options accepted by the {@link Success} constructor.
 *
 * The `Status` parameter carries the literal status code through the type
 * system so the resulting envelope keeps its narrow `status` literal
 * instead of widening to `number`. The constructor defaults the field to
 * `200` when omitted.
 *
 * @typeParam Status - Numeric literal type of the response status code.
 */
export interface SuccessOptions<Status extends number> {
	status?: Status;
}

/**
 * Convenience alias matching any {@link SuccessOptions} regardless of the
 * status parameter.
 *
 * Reach for it where the concrete status is erased — for example, the
 * options argument of the {@link Success} constructor, which destructures
 * `status` without caring about its literal type.
 */
export type AnySuccessOptions = SuccessOptions<any>;

/**
 * Success envelope returned by middlewares, stores, validators, and route
 * handlers to signal a successful result.
 *
 * `success: true` is the discriminant that lets the runtime — and any
 * caller of the framework — tell successes apart from `Error` values
 * without inspecting the status code. `status` keeps the literal HTTP
 * status of the response, defaulting to `200`. `content` is the payload
 * supplied to the constructor.
 *
 * @typeParam Content - Type of the payload supplied to the constructor.
 *   At the type level it flows through {@link ExtractContent}, so a
 *   function-typed `Content` is reported as its awaited return type
 *   even though the constructor stores the function verbatim at runtime.
 * @typeParam Status - Numeric literal type of the response status code.
 *   Defaults to `200`.
 */
export interface Success<Content, Status extends number = 200> {
	content: ExtractContent<Content>;
	status: Status;
	success: true;
}

/**
 * Convenience alias matching any {@link Success} regardless of content or
 * status parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, the union threaded through
 * {@link FilterSuccess} and the success-tagged returns walked by the
 * module compiler.
 */
export type AnySuccess = Success<any, any>;

/**
 * Constructor signature of {@link Success}, declared separately so the
 * value can be defined with a plain `function` and cast to a constructable
 * type.
 */
export interface SuccessConstructor {
	new <const Content, const Status extends number = 200>(
		content: Content,
		options?: SuccessOptions<Status>,
	): Success<Content, Status>;
}

/**
 * Construct a {@link Success} envelope from a content payload and an
 * optional status code.
 *
 * Invoked through `new`. Writes `content`, `status`, and `success: true`
 * onto `this` so the resulting instance carries the three fields the
 * runtime reads when serializing the response. `status` defaults to `200`
 * when it is missing from `options` — either because `options` itself was
 * omitted or because the caller passed an object without the field; the
 * destructuring uses {@link FrozenEmpty} as the default options object to
 * avoid allocating a fresh `{}` on every call.
 *
 * @param content - Payload assigned to `this.content` verbatim. Note that
 *   the interface's type-level {@link ExtractContent} unwrapping is not
 *   mirrored at runtime: a function-typed argument is stored as-is.
 * @param options - Optional behavior switches; see {@link SuccessOptions}.
 * @example
 * ```typescript
 * const created = new Success({ a: "v1" }, { status: 1 });
 *
 * created.content; // { a: "v1" }
 * created.status;  // 1
 * created.success; // true
 * ```
 */
export const Success = function Success(
	this: AnySuccess,
	content: unknown,
	{ status = 200 }: AnySuccessOptions = FrozenEmpty,
) {
	this.content = content;
	this.status = status;
	this.success = true;
} as unknown as SuccessConstructor;
