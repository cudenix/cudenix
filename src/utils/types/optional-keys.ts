/**
 * Identifies keys declared with the optional (`?`) modifier.
 *
 * @example
 * ```typescript
 * type A = OptionalKeys<{ a: string; b?: number; c: boolean | undefined }>;
 * // "b"
 *
 * type B = OptionalKeys<{ a?: string } | { b?: number }>;
 * // "a" | "b"
 * ```
 */
export type OptionalKeys<T extends object> = T extends unknown
	? {
			[K in keyof T]-?: T extends Required<Pick<T, K>> ? never : K;
		}[keyof T]
	: never;
