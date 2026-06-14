/**
 * Keys of `U` that are certainly present. Only these replace the base
 * declaration wholesale.
 */
type ReplacedKeys<U> = {
	[K in keyof U]-?: NonNullable<unknown> extends Pick<U, K> ? never : K;
}[keyof U];

/**
 * Overlay `U` onto `T`, mirroring the runtime object merge.
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
