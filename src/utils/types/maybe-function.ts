/**
 * Resolve to a union of `T` and a zero-argument factory returning `T | Promise<T>`.
 *
 * @example
 * ```typescript
 * const a: MaybeFunction<number> = 1;
 * const b: MaybeFunction<number> = () => 1;
 * const c: MaybeFunction<number> = async () => 1;
 * ```
 */
export type MaybeFunction<T> = T | (() => T | Promise<T>);
