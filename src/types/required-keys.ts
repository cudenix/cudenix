/**
 * @module
 * Type-level required-key selector — picks the keys of an object type whose
 * values cannot be `undefined`.
 *
 * Use {@link RequiredKeys} to derive the "must provide" key set of a type,
 * which makes it useful for building conditional types, validation schemas,
 * or any helper that needs to treat required and optional properties
 * differently.
 */

/**
 * Resolve to the union of keys in `T` whose values cannot be `undefined`.
 *
 * Reach for this when you need the required half of a key set at the type
 * level — for example, to build a `Pick` that drops the optionals, or to
 * generate validation rules only for keys that must be present. The result
 * mirrors how TypeScript itself distinguishes "must provide" from "may omit"
 * properties: any key declared with `?`, or whose value type already includes
 * `undefined`, is treated as optional and stays out of the union.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **`?` keys are excluded** — declaring a key with `?` adds `undefined` to
 *   its value type, which removes it from the union even when you never
 *   write `undefined` explicitly.
 * - **Explicit `undefined` is treated like `?`** — a key typed as
 *   `T | undefined` is also excluded, since its value type already permits
 *   `undefined`.
 * - **`readonly` does not exclude keys** — readonly required keys still
 *   appear in the union; the modifier affects mutation, not optionality.
 * - **Keys typed as `any` are excluded** — because `undefined` is assignable
 *   to `any`, a key whose value type is `any` is treated as optional.
 * - **Empty objects resolve to `never`** — with no keys to inspect, the
 *   union collapses to the empty type.
 *
 * @typeParam T - Object-shaped type whose required keys are extracted. Must
 *   extend `object`.
 * @example
 * Pull the required key set out of a mixed object type.
 * ```typescript
 * type A = { a: string; b?: string; c: number | undefined };
 *
 * type B = RequiredKeys<A>;
 * // "a"
 * ```
 * @example
 * A value typed as `T | undefined` is treated the same as a `?` key.
 * ```typescript
 * type A = RequiredKeys<{ a: string; b: string | undefined }>;
 * // "a"
 * ```
 * @example
 * `readonly` does not change which keys are required.
 * ```typescript
 * type A = RequiredKeys<{ readonly a: number; b?: string }>;
 * // "a"
 * ```
 * @example
 * An object with only optional keys collapses to `never`.
 * ```typescript
 * type A = RequiredKeys<{ a?: string; b?: number }>;
 * // never
 * ```
 */
export type RequiredKeys<T extends object> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];
