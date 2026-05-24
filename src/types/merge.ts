/**
 * @module
 * Shallow type-level merge where the second operand wins.
 */

/**
 * Combine `T` and `U` such that any key declared in
 * `U` overrides the corresponding key in `T`.
 *
 * Produced via two intersected halves: the first keeps every key from
 * `T` that is *not* in `U`, and the second is `U`
 * itself. Unlike a plain `T & U`, the override is decided
 * by the *presence* of the key, not by structural compatibility — so a
 * narrower second type cleanly replaces a wider first type instead of
 * intersecting with it.
 *
 * @typeParam T - Base shape.
 * @typeParam U - Overrides applied on top of `T`.
 * @example
 * ```typescript
 * type A = { a: string; b: string[] };
 * type B = { b: readonly string[]; c: number };
 *
 * type C = Merge<A, B>;
 * // { a: string; b: readonly string[]; c: number }
 * ```
 */
export type Merge<T extends object, U extends object> = {
	[K in keyof T as K extends keyof U ? never : K]: T[K];
} & U;
