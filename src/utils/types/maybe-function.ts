/**
 * Union of `T` and a zero-argument factory returning `T | Promise<T>`. Use it
 * for lazily-evaluated slots like configuration defaults.
 *
 * @example
 * ```typescript
 * const a: MaybeFunction<number> = 1;
 * const b: MaybeFunction<number> = () => 1;
 * const c: MaybeFunction<number> = async () => 1;
 * ```
 */
export type MaybeFunction<T> = T | (() => T | Promise<T>);
