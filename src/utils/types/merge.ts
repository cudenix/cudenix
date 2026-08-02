/**
 * Identifies properties replaced during a type merge.
 */
type ReplacedKeys<U> = {
	// NonNullable<unknown> ({}) extends Pick<U, K> only when K is optional
	[K in keyof U]-?: NonNullable<unknown> extends Pick<U, K> ? never : K;
}[keyof U];

/**
 * Identifies explicitly declared properties in a type.
 */
type DeclaredKeys<T> = {
	// {} extends Record<K, 1> only when K is an index signature, not a literal
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
		? // both key sets are classified once here instead of once per mapped key
			ReplacedKeys<U> extends infer Replaced
			? DeclaredKeys<T> extends infer Declared
				? {
						[K in keyof T as K extends Exclude<Replaced, symbol>
							? never
							: K]: K extends symbol
							? T[K]
							: K extends keyof U
								? T[K] | U[K]
								: T[K];
					} & {
						[K in keyof U as K extends symbol
							? never
							: K extends Declared
								? K extends Replaced
									? K
									: never
								: K]: K extends keyof T
							? K extends Replaced
								? U[K]
								: T[K] | U[K]
							: U[K];
					}
				: never
			: never
		: never
	: never;
