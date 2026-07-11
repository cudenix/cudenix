/**
 * Represents a value or a factory that produces it.
 *
 * @example
 * ```typescript
 * const a: MaybeFunction<number> = 1;
 * const b: MaybeFunction<number> = () => 1;
 * const c: MaybeFunction<number> = async () => 1;
 * ```
 */
export type MaybeFunction<T> = T | (() => T | Promise<T>);
