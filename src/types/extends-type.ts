/**
 * @module
 * Strict bidirectional type-level equality probe.
 */

/**
 * Resolve to `true` when `T` and `U` are assignable to each other in both
 * directions, otherwise `false`. Use this when `T extends U` is too
 * permissive — e.g. distinguishing a literal from its widened primitive, or
 * confirming two derived shapes really line up.
 *
 * Unions are compared as a single shape (no distribution). `any` is permissive
 * on either side and always resolves to `true` — reach for a dedicated
 * `IsAny` helper if you need to detect `any` rather than compare against it.
 *
 * @typeParam T - Candidate type to test for equality.
 * @typeParam U - Reference type compared against `T`.
 * @example
 * ```typescript
 * type A = ExtendsType<string, string>; // true
 * type B = ExtendsType<"v1", string>; // false
 * type C = ExtendsType<{ a: string }, { a: string; b: number }>; // false
 * ```
 */
export type ExtendsType<T, U> = [T, U] extends [U, T] ? true : false;
