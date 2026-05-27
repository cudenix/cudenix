import type { ExtractContent } from "@/types/extract-content";
import { FrozenEmpty } from "@/utils/objects/empty";

/**
 * @module
 * Success envelope plus the type-level utilities that filter, transform, and
 * merge success dictionaries.
 */

/**
 * Pick every {@link AnySuccess}-shaped member out of `T`. Use it to isolate
 * the success half of a handler's return union before the module compiler
 * folds it into the parent's success dictionary.
 *
 * Thin wrapper over the builtin `Extract<T, AnySuccess>` — members that are
 * not assignable to {@link AnySuccess} are discarded.
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
 * Re-key a single {@link AnySuccess} by its `status` code, producing the
 * one-entry record `{ [T["status"]]: T }`. Used by the module compiler so
 * the per-module success map stays deduplicated when two units emit the
 * same status.
 *
 * @typeParam T - Success envelope whose `status` becomes the dictionary key.
 * @example
 * ```typescript
 * type A = TransformSuccess<Success<"v1", 200>>;
 * // { 200: Success<"v1", 200> }
 * ```
 */
export type TransformSuccess<T extends AnySuccess> = Record<T["status"], T>;

/**
 * Deeply merge two status-keyed success dictionaries. Reached for by
 * `Module.extends`, `Module.middleware`, `Module.route`, `Module.store`, and
 * `Module.validator` to accumulate the success shapes contributed by each
 * unit without dropping any branch.
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
export type MergeSuccesses<T extends object, U extends object> = {
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
 * Options accepted by the {@link Success} constructor. The `Status`
 * parameter threads the literal status code through the type system so the
 * resulting envelope keeps its narrow `status` literal instead of widening
 * to `number`. Defaults to `200` when omitted.
 *
 * @typeParam Status - Numeric literal type of the response status code.
 * @example
 * ```typescript
 * const a: SuccessOptions<201> = { status: 201 };
 *
 * new Success({ id: 1 }, a); // Success<{ id: 1 }, 201>
 * ```
 */
export interface SuccessOptions<Status extends number = 200> {
	status?: Status;
}

/**
 * Convenience alias matching any {@link SuccessOptions} regardless of the
 * status parameter. Reach for it where the concrete status is erased — for
 * example, the options argument of the {@link Success} constructor, which
 * destructures `status` without caring about its literal type.
 *
 * @example
 * ```typescript
 * const fn = ({ status = 200 }: AnySuccessOptions) => status;
 *
 * fn({ status: 201 }); // 201
 * fn({}); // 200
 * ```
 */
export type AnySuccessOptions = SuccessOptions<any>;

/**
 * Success envelope returned by middlewares, stores, validators, and route
 * handlers to signal a successful response. `success: true` is the
 * discriminant that lets the runtime tell successes apart from `Error`
 * values without inspecting the status code.
 *
 * @typeParam Content - Type of the payload supplied to the constructor. At
 *   the type level it flows through {@link ExtractContent}, so a
 *   function-typed `Content` is reported as its awaited return type even
 *   though the constructor stores the function verbatim at runtime.
 * @typeParam Status - Numeric literal type of the response status code.
 *   Defaults to `200`.
 * @example
 * ```typescript
 * const a: Success<{ a: "v1" }, 200> = {
 *   content: { a: "v1" },
 *   status: 200,
 *   success: true,
 * };
 * ```
 */
export interface Success<Content, Status extends number = 200> {
	content: ExtractContent<Content>;
	status: Status;
	success: true;
}

/**
 * Convenience alias matching any {@link Success} regardless of content or
 * status parameters. Reach for it in container or registry types where the
 * concrete generics are irrelevant — for example, the union threaded
 * through {@link FilterSuccess} or the success-tagged returns walked by the
 * module compiler.
 *
 * @example
 * ```typescript
 * const a: AnySuccess = new Success({ a: "v1" });
 *
 * a.status; // 200
 * a.success; // true
 * ```
 */
export type AnySuccess = Success<any, any>;

/**
 * Constructor signature of {@link Success}, declared separately so the
 * runtime value can be defined with a plain `function` and cast to a
 * constructable type.
 *
 * @example
 * ```typescript
 * const Ctor: SuccessConstructor = Success;
 *
 * const a = new Ctor({ a: "v1" }, { status: 201 });
 *
 * a.status; // 201
 * ```
 */
export interface SuccessConstructor {
	new <const Content, const Status extends number = 200>(
		content: Content,
		options?: SuccessOptions<Status>,
	): Success<Content, Status>;
}

/**
 * Construct a {@link Success} envelope from a content payload and an
 * optional status code. Must be invoked with `new`; the resulting instance
 * carries `content`, `status`, and `success: true` — the three fields the
 * runtime reads when serializing the response.
 *
 * `status` defaults to `200` when `options` is omitted; {@link FrozenEmpty}
 * is the default options object, so the no-argument path skips a fresh `{}`
 * allocation. The interface's type-level {@link ExtractContent} unwrapping
 * is not mirrored at runtime — a function-typed `content` is stored as-is.
 *
 * @param content - Payload assigned to `this.content` verbatim.
 * @param options - Optional behavior switches; see {@link SuccessOptions}.
 * @example
 * ```typescript
 * const a = new Success({ a: "v1" });
 *
 * a.content; // { a: "v1" }
 * a.status;  // 200
 * a.success; // true
 *
 * const b = new Success({ id: 1 }, { status: 201 });
 *
 * b.status; // 201
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
