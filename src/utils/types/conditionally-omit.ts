/**
 * @module
 * Drop keys from an object type when their value type matches a marker.
 */

/**
 * Union of keys in `T` whose value type is mutually assignable with `U`.
 */
type OmitKeys<T extends object, U> = {
	[K in keyof T]: [T[K], U] extends [U, T[K]] ? K : never;
}[keyof T];

/**
 * Remove every key from `T` whose value type is mutually assignable with `U`.
 * Use it to strip sentinel slots (e.g. `never`-typed) from a generated object.
 *
 * @example
 * ```typescript
 * type A = ConditionallyOmit<{ a: string; b: never; c: number }, never>;
 * // { a: string; c: number }
 * ```
 */
export type ConditionallyOmit<T extends object, U> = Omit<T, OmitKeys<T, U>>;
