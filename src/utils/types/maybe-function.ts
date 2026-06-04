/**
 * @module
 * Value-or-factory union — a slot that accepts a concrete value or a
 * zero-argument producer that yields one (sync or async).
 */

/**
 * Union of `T` and a zero-argument factory returning `T | Promise<T>`. Use it
 * on framework seams that should evaluate input lazily — configuration
 * defaults, registration-time options, or any slot where the cost of
 * producing the value should be deferred.
 *
 * The factory must be callable with no arguments; a function requiring one or
 * more parameters does not satisfy the alias, though optional and rest
 * parameters remain compatible. A producer can quietly upgrade from sync to
 * async work later without breaking callers.
 *
 * @typeParam T - Value type the producer ultimately yields.
 * @example
 * ```typescript
 * type A = MaybeFunction<number>;
 * // number | (() => number | Promise<number>)
 *
 * // All three branches satisfy the alias:
 * const a: MaybeFunction<number> = 1;
 * const b: MaybeFunction<number> = () => 1;
 * const c: MaybeFunction<number> = async () => 1;
 * ```
 */
export type MaybeFunction<T> = T | (() => T | Promise<T>);
