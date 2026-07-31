/**
 * Materializes an object type into a single, readable property map.
 *
 * @example
 * ```typescript
 * type A = Prettify<{ a: string } & { b?: number }>;
 * // { a: string; b?: number }
 * ```
 */
export type Prettify<T extends object> = {
	[K in keyof T]: T[K];
};
