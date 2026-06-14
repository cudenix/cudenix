/**
 * Union of `T` and `Promise<T>`. Use it on seams that accept either a direct
 * value or a promise, so the consumer can `await` uniformly.
 *
 * @example
 * ```typescript
 * type A = MaybePromise<number>; // number | Promise<number>
 * type B = Awaited<MaybePromise<number>>; // number
 * ```
 */
export type MaybePromise<T> = T | Promise<T>;
