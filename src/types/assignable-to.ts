/**
 * @module
 * Type-level one-directional assignability probe — answer whether a candidate
 * type can flow into a reference type without triggering union distribution.
 *
 * Use {@link AssignableTo} when you need a subtype check at the type level —
 * confirming that a literal lands in its widened parent, that a value
 * satisfies a wrapper union like `MaybePromise<T>`, or that an unrelated
 * shape is rejected by a structural target.
 */

/**
 * Resolve to `true` when `T` is assignable to `U`, otherwise to `false`.
 *
 * Reach for this whenever you need a one-directional subtype probe at the
 * type level — verifying that a literal flows into its widening primitive,
 * that a value lands inside a `MaybePromise<T>` wrapper, that an object with
 * extra keys still satisfies a smaller required shape, or that an unrelated
 * candidate is rejected by a structural target. Unlike {@link ExtendsType},
 * only the direction `T → U` is checked: the reference side may be wider
 * than the candidate, so a literal happily satisfies its primitive parent
 * while the reverse comparison still resolves to `false`.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **One direction only** — the relation tested is `T extends U`. A wider
 *   `U` accepts a narrower `T`, but the reverse does not hold. For a strict
 *   bidirectional equality probe, reach for {@link ExtendsType} instead.
 * - **Union distribution is suppressed** — both operands are wrapped in
 *   single-element tuples, so a union `T` is compared as one shape rather
 *   than being split member-by-member.
 *   `AssignableTo<"v1" | "v2", "v1">` resolves to `false` instead of
 *   distributing into `true | false`.
 * - **Literals flow into primitives** — `"v1"` is assignable to `string`,
 *   `1` to `number`, `true` to `boolean`. The reverse direction never holds.
 * - **A union member flows into its union** — any single member of `U` is
 *   assignable to `U`, which is the canonical way to probe a wrapper union
 *   from one of its branches.
 * - **Width subtyping on objects** — a candidate carrying extra keys flows
 *   into a smaller shape, since the reference only constrains the keys it
 *   lists. Missing required keys, however, cause the relation to fail.
 * - **`never` is the universal subtype** — `AssignableTo<never, U>` is
 *   always `true`, regardless of what `U` is.
 * - **`any` and `unknown` are universal supertypes** — every type is
 *   assignable to both, so `AssignableTo<T, any>` and
 *   `AssignableTo<T, unknown>` are always `true`.
 * - **`any` does not collapse to `never`** — because tuple wrapping
 *   suppresses `any`-distribution, `AssignableTo<any, never>` resolves to
 *   `false` rather than the loose `true` you would get from a naked check.
 *
 * @typeParam T - Candidate type expected to flow into `U`.
 * @typeParam U - Reference type that should accept `T`.
 * @example
 * A literal flows into its widening primitive, but the reverse direction is
 * rejected.
 * ```typescript
 * type A = AssignableTo<"v1", string>;
 * // true
 *
 * type B = AssignableTo<string, "v1">;
 * // false
 * ```
 * @example
 * A single member is assignable to its union, which is the typical wrapper
 * probe shape.
 * ```typescript
 * type A = AssignableTo<number, number | string>;
 * // true
 *
 * type B = AssignableTo<string, number>;
 * // false
 * ```
 * @example
 * Union distribution is suppressed by the tuple wrapping, so a union
 * candidate is rejected by a narrower reference instead of splitting into
 * `true | false`.
 * ```typescript
 * type A = AssignableTo<"v1" | "v2", "v1">;
 * // false
 *
 * type B = AssignableTo<"v1" | "v2", string>;
 * // true
 * ```
 * @example
 * Object width subtyping flows from the candidate side — extra keys are
 * fine, missing required keys are not.
 * ```typescript
 * type A = AssignableTo<{ a: string; b: number }, { a: string }>;
 * // true
 *
 * type B = AssignableTo<{ a: string }, { a: string; b: number }>;
 * // false
 * ```
 * @example
 * `never` is the universal subtype and `unknown` is a universal supertype,
 * while `any` flowing into `never` is rejected because tuple wrapping
 * suppresses `any`-distribution.
 * ```typescript
 * type A = AssignableTo<never, string>;
 * // true
 *
 * type B = AssignableTo<string, unknown>;
 * // true
 *
 * type C = AssignableTo<any, never>;
 * // false
 * ```
 */
export type AssignableTo<T, U> = [T] extends [U] ? true : false;
