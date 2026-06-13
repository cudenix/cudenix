/**
 * @module
 * Type-level shallow merge — overlay an overrides type onto a base type,
 * mirroring the key-copy semantics of the runtime object merge.
 */

/**
 * Keys of `U` that are certainly present — declared without `?` and not from
 * an index signature. Only these replace the base declaration wholesale.
 */
type ReplacedKeys<U> = {
	[K in keyof U]-?: NonNullable<unknown> extends Pick<U, K> ? never : K;
}[keyof U];

/**
 * Overlay `U` onto `T`: keys only in `T` are kept, keys present in both take
 * `U`'s type, and keys only in `U` are added. Mirrors the runtime object
 * merge, and unlike `T & U` a replaced key takes `U`'s type cleanly.
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
					: K extends keyof T
						? K extends ReplacedKeys<U>
							? K
							: never
						: K]: U[K];
			}
		: never
	: never;
