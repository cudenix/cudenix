/**
 * @module
 * Bidirectional type-equality conditional.
 */

/**
 * Resolve to `true` when `T` and `U` are mutually assignable,
 * otherwise to `false`.
 *
 * A plain `T extends U ? true : false` only checks assignability in
 * one direction, so it accepts subtypes that are not actually the same
 * type. Comparing the tuples `[T, U]` against `[U, T]`
 * forces the relation to hold both ways — equivalent to a strict equality
 * probe at the type level. The tuple wrapping also suppresses the implicit
 * distribution that conditional types perform over naked union operands,
 * so the comparison treats `T` as a single shape rather than splitting
 * it member-by-member.
 *
 * @typeParam T - Candidate type to test.
 * @typeParam U - Reference type compared against `T`.
 * @example
 * ```typescript
 * type A = ExtendsType<string, string>; // true
 * type B = ExtendsType<"v1", string>;   // false (subtype only)
 * type C = ExtendsType<string, "v1">;   // false (supertype only)
 * ```
 */
export type ExtendsType<T, U> = [T, U] extends [U, T] ? true : false;
