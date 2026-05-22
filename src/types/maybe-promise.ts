/**
 * @module
 * Sync-or-async value helper.
 */

/**
 * Permit a value to arrive either synchronously or wrapped in a promise.
 *
 * Reach for it on hot paths that may short-circuit before any async work is
 * needed — the consuming code can `await` the result without paying a tick
 * when the producer was synchronous.
 *
 * @typeParam Type - Value type that may also arrive as a `Promise<Type>`.
 * @example
 * ```typescript
 * type A = MaybePromise<number>;             // number | Promise<number>
 * type B = MaybePromise<number | undefined>; // number | undefined | Promise<number | undefined>
 * type C = Awaited<MaybePromise<number>>;    // number
 * ```
 */
export type MaybePromise<Type> = Type | Promise<Type>;
