/**
 * Marks as optional every property whose type accepts a given marker.
 *
 * @example
 * ```typescript
 * type A = ConditionallyOptional<
 *   { a: string; b: string | undefined },
 *   undefined
 * >;
 * // { a: string; b?: string | undefined }
 *
 * type B = ConditionallyOptional<{ a: string } | { b: number }, string>;
 * // { a?: string } | { b: number }
 * ```
 */
export type ConditionallyOptional<T extends object, U> = T extends unknown
	? T extends readonly unknown[]
		? T
		: {
					[K in keyof T]-?: U extends T[K] ? K : never;
					// narrows OptionalKeys to keys of T
				}[keyof T] extends infer OptionalKeys extends keyof T
			? Omit<T, OptionalKeys> & {
					[K in OptionalKeys]?: T[K];
				}
			: never
	: never;
