/**
 * Make every key of `T` whose value type accepts `U` optional (`?`).
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
}[keyof T] extends infer OptionalKeys extends keyof T
	? Omit<T, OptionalKeys> & {
			[K in OptionalKeys]?: T[K];
		}
	: never;
