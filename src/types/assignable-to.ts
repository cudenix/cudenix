/**
 * @module
 * One-directional type-assignability conditional.
 */

/**
 * Resolve to `true` when `Sub` is assignable to `Super`, otherwise to `false`.
 *
 * Unlike [[extends-type]], the relation is checked in a single direction — the
 * supertype side is allowed to be wider than the candidate. Wrapping both
 * operands in single-element tuples suppresses the implicit distribution that
 * conditional types perform over naked union operands, so the comparison
 * treats `Sub` as a single shape rather than splitting it member-by-member.
 *
 * Reach for it inside type-level test suites when a subtype probe is the
 * intent — confirming that a literal flows into its branded supertype, that a
 * concrete value lands in a `MaybePromise<T>` union, or that an unrelated
 * shape is rejected by a structural target.
 *
 * @typeParam Sub - Candidate type expected to be assignable to `Super`.
 * @typeParam Super - Reference type that should accept `Sub`.
 * @example
 * ```typescript
 * type A = AssignableTo<"foo", string>;            // true  (literal → primitive)
 * type B = AssignableTo<string, "foo">;            // false (primitive → literal)
 * type C = AssignableTo<number, number | string>;  // true  (member → union)
 * type D = AssignableTo<"a" | "b", "a">;           // false (union not distributed)
 * ```
 */
export type AssignableTo<Sub, Super> = [Sub] extends [Super] ? true : false;
