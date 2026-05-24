/**
 * @module
 * Type-level shallow merge — combine two object types where the second
 * operand wins on every overlapping key.
 *
 * Use {@link Merge} to overlay an overrides type on top of a base type
 * without the structural blending you would get from a plain `T & U`
 * intersection, which keeps narrower or otherwise incompatible replacements
 * clean instead of collapsing them into the wider original.
 */

/**
 * Resolve to a type that carries every key from `T`, with any key also
 * declared in `U` replaced wholesale by `U`'s declaration.
 *
 * Reach for this whenever you have a base shape and a partial set of
 * overrides — user options on top of defaults, a refined route-params type
 * on top of the router's inferred one, a per-call patch on top of a generated
 * config — and you want the override to win cleanly even when the value types
 * do not intersect. Unlike `T & U`, the result is decided by the *presence*
 * of the key in `U`, so a narrower or unrelated second type does not get
 * blended with the first one.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Second operand wins** — for keys present in both sides, the value type
 *   comes from `U`. There is no structural intersection with the value type
 *   in `T`.
 * - **Shallow** — overlapping nested object keys are replaced wholesale, not
 *   merged recursively. To merge nested shapes, apply `Merge` to each level
 *   yourself.
 * - **Presence-based replacement** — `U` overrides on key presence alone,
 *   even when `U[K]` is not assignable to `T[K]`. A narrower, wider, or
 *   entirely unrelated value type all replace the original cleanly.
 * - **Optionality follows the winning side** — if `U` declares a key with
 *   `?`, the result is optional regardless of whether `T` made it required;
 *   keys contributed only by `T` keep their original optionality.
 * - **`readonly` is preserved per side** — keys taken from `T` keep `T`'s
 *   `readonly` modifier; keys taken from `U` keep `U`'s.
 * - **Empty operands pass through** — `Merge<{}, U>` resolves to `U` and
 *   `Merge<T, {}>` resolves to `T`.
 *
 * @typeParam T - Base shape whose keys are inherited unless overridden by
 *   `U`. Must extend `object`.
 * @typeParam U - Overrides shape applied on top of `T`. Must extend `object`.
 * @example
 * Apply an override on top of a base shape — the overlapping key takes the
 * value type from the second operand, and new keys from `U` are added.
 * ```typescript
 * type A = { a: string; b: number };
 * type B = { b: boolean; c: string };
 *
 * type C = Merge<A, B>;
 * // { a: string; b: boolean; c: string }
 * ```
 * @example
 * Replacement is decided by key presence, so a narrower second type cleanly
 * replaces the wider first instead of intersecting with it.
 * ```typescript
 * type A = { a: string[] };
 * type B = { a: readonly string[] };
 *
 * type C = Merge<A, B>;
 * // { a: readonly string[] }
 * ```
 * @example
 * When `U` redeclares a required key as optional, the result follows the
 * overriding side.
 * ```typescript
 * type A = { a: string; b: number };
 * type B = { b?: number };
 *
 * type C = Merge<A, B>;
 * // { a: string; b?: number }
 * ```
 * @example
 * Empty operands act as identities on either side.
 * ```typescript
 * type A = Merge<{}, { a: string }>;
 * // { a: string }
 *
 * type B = Merge<{ a: string }, {}>;
 * // { a: string }
 * ```
 */
export type Merge<T extends object, U extends object> = {
	[K in keyof T as K extends keyof U ? never : K]: T[K];
} & U;
