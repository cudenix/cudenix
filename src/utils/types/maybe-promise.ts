/**
 * Represents a synchronous or asynchronous value.
 *
 * @example
 * ```typescript
 * type A = MaybePromise<number>; // number | Promise<number>
 * type B = Awaited<MaybePromise<number>>; // number
 * ```
 */
export type MaybePromise<T> = T | Promise<T>;
