/**
 * @module
 * Type-level strict-equality probe — resolve to `true` only when two types
 * are mutually assignable, otherwise `false`.
 *
 * Use {@link ExtendsType} when a one-directional `extends` check is too
 * loose for the comparison you need — distinguishing a string literal from
 * `string` itself, asserting a generic landed at full width rather than
 * widened, or proving two derived shapes really line up before treating
 * them as interchangeable.
 */

/**
 * Resolve to `true` when `T` and `U` are assignable to each other in both
 * directions, otherwise to `false`.
 *
 * Reach for this whenever a plain `T extends U` is too permissive — when
 * you need to detect that two types are *the same* rather than that one is
 * a subset of the other. Common spots: gating a conditional branch behind
 * an exact match, asserting a generic was inferred at full width, or
 * comparing two derived shapes before letting downstream code treat them
 * as equivalent.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Bidirectional** — both `T extends U` and `U extends T` must hold for
 *   the result to be `true`. A subtype on either side resolves to `false`.
 * - **Strict on literals** — `"v1"` and `string` are not equal here, even
 *   though the literal is assignable to the wider type. The literal width
 *   has to match on both sides.
 * - **No union distribution** — union operands are compared as a single
 *   shape against the reference type rather than splitting member-by-member,
 *   so `"v1" | "v2"` is matched against the union as a whole.
 * - **Order independent** — swapping the operands does not change the
 *   result, since the relation is symmetric.
 * - **`any` is permissive on both sides** — because `any` is assignable to
 *   and from every type, comparing `any` against another type always
 *   resolves to `true`. Reach for a dedicated `IsAny` helper when you need
 *   to detect `any` rather than compare against it.
 *
 * @typeParam T - Candidate type to test for equality.
 * @typeParam U - Reference type compared against `T`.
 * @example
 * Two identical types resolve to `true`; a one-directional subtype resolves
 * to `false` because the reverse direction fails.
 * ```typescript
 * type A = ExtendsType<string, string>;
 * // true
 *
 * type B = ExtendsType<"v1", string>;
 * // false
 *
 * type C = ExtendsType<string, "v1">;
 * // false
 * ```
 * @example
 * Object shapes must match key-for-key in both directions — adding a key
 * on either side breaks the equality.
 * ```typescript
 * type A = ExtendsType<{ a: string }, { a: string }>;
 * // true
 *
 * type B = ExtendsType<{ a: string }, { a: string; b: number }>;
 * // false
 * ```
 * @example
 * Unions stay whole — they are not distributed across the conditional, so
 * the comparison treats each union as one shape.
 * ```typescript
 * type A = ExtendsType<"v1" | "v2", "v1" | "v2">;
 * // true
 *
 * type B = ExtendsType<"v1" | "v2", "v1">;
 * // false
 * ```
 * @example
 * `any` slips through the equality check on both sides, while `unknown`
 * behaves as you would expect.
 * ```typescript
 * type A = ExtendsType<any, string>;
 * // true
 *
 * type B = ExtendsType<unknown, string>;
 * // false
 * ```
 */
export type ExtendsType<T, U> = [T, U] extends [U, T] ? true : false;
