/**
 * Identifies keys declared with the optional (`?`) modifier.
 *
 * @example
 * ```typescript
 * type A = OptionalKeys<{ a: string; b?: number; c: boolean | undefined }>;
 * // "b"
 * ```
 */
export type OptionalKeys<T extends object> = {
	[K in keyof T]-?: T extends Required<Pick<T, K>> ? never : K;
}[keyof T];
