/**
 * @module
 * Union of keys in an object type whose values cannot be `undefined`.
 */

/**
 * Pick the keys of `T` that are required at the type level — any key declared
 * with `?`, or whose value type already includes `undefined`, is excluded.
 * Use it to build `Pick`s that drop the optionals, or generate validation
 * rules only for must-provide keys.
 *
 * - `readonly` does not exclude keys.
 * - Keys typed as `any` are excluded (because `undefined` is assignable to
 *   `any`).
 * - Empty objects resolve to `never`.
 *
 * @typeParam T - Object-shaped type whose required keys are extracted.
 * @example
 * ```typescript
 * type A = RequiredKeys<{ a: string; b?: string; c: number | undefined }>; // "a"
 * type B = RequiredKeys<{ readonly a: number; b?: string }>; // "a"
 * type C = RequiredKeys<{ a?: string; b?: number }>; // never
 * ```
 */
export type RequiredKeys<T extends object> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];
