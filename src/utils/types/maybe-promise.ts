/**
 * Resolve to a union of `T` and `Promise<T>`.
 *
 * @example
 * ```typescript
 * type A = MaybePromise<number>; // number | Promise<number>
 * type B = Awaited<MaybePromise<number>>; // number
 * ```
 */
export type MaybePromise<T> = T | Promise<T>;
