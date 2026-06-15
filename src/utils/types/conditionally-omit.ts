/**
 * Resolve to a union of keys in `T` whose value type is mutually assignable
 * with `U`.
 */
type OmitKeys<T extends object, U> = {
	[K in keyof T]: [T[K], U] extends [U, T[K]] ? K : never;
}[keyof T];

/**
 * Remove every key from `T` whose value type is mutually assignable with `U`.
 *
 * @example
 * ```typescript
 * type A = ConditionallyOmit<{ a: string; b: never; c: number }, never>;
 * // { a: string; c: number }
 * ```
 */
export type ConditionallyOmit<T extends object, U> = Omit<T, OmitKeys<T, U>>;
