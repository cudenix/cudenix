/**
 * @module
 * One-directional type-level assignability probe (no union distribution).
 */

/**
 * Resolve to `true` when `T` is assignable to `U`, otherwise `false`.
 *
 * Only the direction `T → U` is checked, so a literal flows into its widening
 * primitive but the reverse resolves to `false`. Tuple-wrapping both operands
 * suppresses union distribution — a union `T` is compared as one shape rather
 * than splitting into `true | false`. For mutual assignability in both
 * directions use {@link ExtendsType} instead.
 *
 * @typeParam T - Candidate type expected to flow into `U`.
 * @typeParam U - Reference type that should accept `T`.
 * @example
 * ```typescript
 * type A = AssignableTo<"v1", string>; // true
 * type B = AssignableTo<string, "v1">; // false
 * type C = AssignableTo<"v1" | "v2", "v1">; // false (no distribution)
 * type D = AssignableTo<never, string>; // true
 * ```
 */
export type AssignableTo<T, U> = [T] extends [U] ? true : false;
