/**
 * Identifies properties replaced during a type merge.
 */
type ReplacedKeys<U> = keyof {
	// {} extends Pick<U, K> only when K is optional
	[K in keyof U as NonNullable<unknown> extends Pick<U, K> ? never : K]: U[K];
};

/**
 * Identifies explicitly declared properties in a type.
 */
type DeclaredKeys<T> = keyof {
	// {} extends Record<K, 1> only for index signatures
	[K in keyof T as NonNullable<unknown> extends Record<K, 1>
		? never
		: K]: T[K];
};

/**
 * JavaScript coerces numeric property keys to strings.
 */
type PropertyName<K> = K extends number ? `${K}` : K;

/**
 * Looks up a key using either spelling of a numeric property name.
 */
type ValueAt<T, K> = K extends keyof T
	? T[K]
	: K extends number
		? `${K}` extends keyof T
			? T[`${K}`]
			: never
		: K extends `${infer N extends number}`
			? `${N}` extends K
				? N extends keyof T
					? T[N]
					: never
				: never
			: never;

/**
 * Includes values whose property names can fall inside an index signature.
 * An index signature cannot exclude a single overridden key, so its value
 * must also admit that key's value in the other operand.
 */
type OverlappingValues<T, K> = {
	[P in keyof T]-?: [PropertyName<P> & PropertyName<K>] extends [never]
		? never
		: [T[P]];
}[keyof T] extends infer Values
	? Values extends [infer Value]
		? Value
		: never
	: never;

/**
 * Combines two object types by overlaying one onto the other.
 *
 * @example
 * ```typescript
 * type A = Merge<{ a: string; b: number }, { b: boolean; c: string }>;
 * // { a: string; b: boolean; c: string }
 *
 * type B = Merge<Record<string, number>, { a: string }>;
 * // { [key: string]: number | string } & { a: string }
 * ```
 */
export type Merge<T extends object, U extends object> = T extends unknown
	? U extends unknown
		? // classify both key sets
			PropertyName<ReplacedKeys<U>> extends infer Replaced
			? PropertyName<DeclaredKeys<T>> extends infer Declared
				? {
						[K in keyof T as PropertyName<K> extends Exclude<
							Replaced,
							symbol
						>
							? never
							: K]: K extends symbol
							? T[K]
							: NonNullable<unknown> extends Record<K, 1>
								? T[K] | OverlappingValues<U, K>
								: T[K] | ValueAt<U, K>;
					} & {
						[K in keyof U as K extends symbol
							? never
							: PropertyName<K> extends Declared
								? PropertyName<K> extends Replaced
									? K
									: never
								: K]: PropertyName<K> extends Replaced
							? U[K]
							: NonNullable<unknown> extends Record<K, 1>
								? U[K] | OverlappingValues<T, K>
								: U[K] | ValueAt<T, K>;
					}
				: never
			: never
		: never
	: never;
