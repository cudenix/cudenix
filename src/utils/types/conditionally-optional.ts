/**
 * @module
 * Make keys optional when their value type already admits a given marker.
 */

/**
 * Copy of `T` where every key whose value type accepts `U` becomes optional
 * (`?`). Use it to turn explicit `| undefined` fields into truly optional ones.
 *
 * @example
 * ```typescript
 * type A = ConditionallyOptional<
 *   { a: string; b: string | undefined },
 *   undefined
 * >;
 * // { a: string; b?: string | undefined }
 * ```
 */
export type ConditionallyOptional<T extends object, U> = {
	[K in keyof T]-?: U extends T[K] ? K : never;
}[keyof T] extends infer UK extends keyof T
	? Omit<T, UK> & {
			[K in UK]?: T[K];
		}
	: never;
