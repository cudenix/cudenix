/**
 * @module
 * One-directional type-assignability conditional.
 */

/**
 * Resolve to `true` when `T` is assignable to `U`, otherwise to `false`.
 *
 * Unlike {@link ExtendsType}, the relation is checked in a single direction — the
 * supertype side is allowed to be wider than the candidate. Wrapping both
 * operands in single-element tuples suppresses the implicit distribution that
 * conditional types perform over naked union operands, so the comparison
 * treats `T` as a single shape rather than splitting it member-by-member.
 *
 * Reach for it inside type-level test suites when a subtype probe is the
 * intent — confirming that a literal flows into its branded supertype, that a
 * concrete value lands in a `MaybePromise<T>` union, or that an unrelated
 * shape is rejected by a structural target.
 *
 * @typeParam T - Candidate type expected to be assignable to `U`.
 * @typeParam U - Reference type that should accept `T`.
 * @example
 * ```typescript
 * type A = AssignableTo<"v1", string>;             // true  (literal → primitive)
 * type B = AssignableTo<string, "v1">;             // false (primitive → literal)
 * type C = AssignableTo<number, number | string>;  // true  (member → union)
 * type D = AssignableTo<"v1" | "v2", "v1">;        // false (union not distributed)
 * ```
 */
export type AssignableTo<T, U> = [T] extends [U] ? true : false;
