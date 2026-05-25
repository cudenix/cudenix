/**
 * @module
 * Sync-or-async value type — `T` or `Promise<T>`.
 */

/**
 * Union of `T` and `Promise<T>`. Use this on framework seams (handlers,
 * middleware, hooks) that should accept either a direct value or a promise,
 * letting the consumer `await` the result uniformly.
 *
 * Unions inside `T` are wrapped as a whole (`MaybePromise<A | B>` resolves to
 * `A | B | Promise<A | B>`, not `MaybePromise<A> | MaybePromise<B>`).
 * `undefined` and `null` are not added implicitly — include them in `T` if
 * the producer may return nothing.
 *
 * @typeParam T - Value type that may also arrive as `Promise<T>`.
 * @example
 * ```typescript
 * type A = MaybePromise<number>; // number | Promise<number>
 * type B = Awaited<MaybePromise<number>>; // number
 * ```
 */
export type MaybePromise<T> = T | Promise<T>;
