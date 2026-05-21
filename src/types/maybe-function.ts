/**
 * @module
 * Value-or-factory helper.
 */

/**
 * Accept either a concrete `Type` or a zero-argument factory that produces
 * one — synchronously or asynchronously.
 *
 * Useful for slots that should be evaluated lazily — for example,
 * configuration values whose dependencies are only resolved at registration
 * time, or defaults that should not be computed when a caller supplies an
 * explicit value.
 *
 * @typeParam Type - Value type the producer ultimately yields.
 * @example
 * ```typescript
 * type A = MaybeFunction<number>;
 * // number | (() => number | Promise<number>)
 *
 * type B = number extends MaybeFunction<number> ? true : false;
 * // true (concrete value)
 *
 * type C = (() => number) extends MaybeFunction<number> ? true : false;
 * // true (sync factory)
 *
 * type D = (() => Promise<number>) extends MaybeFunction<number> ? true : false;
 * // true (async factory)
 * ```
 */
export type MaybeFunction<Type> = Type | (() => Type | Promise<Type>);
