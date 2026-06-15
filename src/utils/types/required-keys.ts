/**
 * Resolve to the keys of `T` that are required (not optional and not
 * `undefined`).
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
