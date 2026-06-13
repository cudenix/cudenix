/**
 * @module
 * Union of keys in an object type whose values cannot be `undefined`.
 */

/**
 * Pick the keys of `T` that are required — any key declared with `?`, or whose
 * type already includes `undefined`, is excluded.
 *
 * @example
 * ```typescript
 * type A = RequiredKeys<{ a: string; b?: string; c: number | undefined }>; // "a"
 * type B = RequiredKeys<{ a?: string; b?: number }>; // never
 * ```
 */
export type RequiredKeys<T extends object> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];
