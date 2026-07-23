/**
 * Identifies properties whose value type matches another type.
 */
type OmitKeys<T extends object, U> = {
	// tuple form checks assignability both ways without distributing over U
	[K in keyof T]: [T[K], U] extends [U, T[K]] ? K : never;
}[keyof T];

/**
 * Removes properties that match a given value type.
 *
 * @example
 * ```typescript
 * type A = ConditionallyOmit<{ a: string; b: never; c: number }, never>;
 * // { a: string; c: number }
 * ```
 */
export type ConditionallyOmit<T extends object, U> = Omit<T, OmitKeys<T, U>>;
