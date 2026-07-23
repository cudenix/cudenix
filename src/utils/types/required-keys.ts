/**
 * Identifies keys of an object type whose values cannot be undefined.
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
