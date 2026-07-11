/**
 * Identifies properties replaced during a type merge.
 */
type ReplacedKeys<U> = {
	[K in keyof U]-?: NonNullable<unknown> extends Pick<U, K> ? never : K;
}[keyof U];

/**
 * Identifies explicitly declared properties in a type.
 */
type DeclaredKeys<T> = {
	[K in keyof T]-?: NonNullable<unknown> extends Record<K, 1> ? never : K;
}[keyof T];

/**
 * Combines two object types by overlaying one onto the other.
 *
 * @example
 * ```typescript
 * type A = Merge<{ a: string; b: number }, { b: boolean; c: string }>;
 * // { a: string; b: boolean; c: string }
 * ```
 */
export type Merge<T extends object, U extends object> = T extends unknown
	? U extends unknown
		? {
				[K in keyof T as K extends Exclude<ReplacedKeys<U>, symbol>
					? never
					: K]: K extends symbol
					? T[K]
					: K extends keyof U
						? T[K] | U[K]
						: T[K];
			} & {
				[K in keyof U as K extends symbol
					? never
					: K extends DeclaredKeys<T>
						? K extends ReplacedKeys<U>
							? K
							: never
						: K]: K extends keyof T
					? K extends ReplacedKeys<U>
						? U[K]
						: T[K] | U[K]
					: U[K];
			}
		: never
	: never;
