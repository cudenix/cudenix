export type Merge<T extends object, U extends object> = T extends unknown
	? U extends unknown
		? PropertyName<ReplacedKeys<U>> extends infer Replaced
			? PropertyName<DeclaredKeys<T>> extends infer Declared
				? {
						[
							K in keyof T as PropertyName<K> extends Exclude<
								Replaced,
								symbol
							>
								? never
								: K
						]: K extends symbol
							? T[K]
							: NonNullable<unknown> extends Record<K, 1>
								? OverlappingValues<U, K> | T[K]
								: T[K] | ValueAt<U, K>;
					} & {
						[
							K in keyof U as K extends symbol
								? never
								: PropertyName<K> extends Declared
									? PropertyName<K> extends Replaced
										? K
										: never
									: K
						]: PropertyName<K> extends Replaced
							? U[K]
							: NonNullable<unknown> extends Record<K, 1>
								? OverlappingValues<T, K> | U[K]
								: U[K] | ValueAt<T, K>;
					}
				: never
			: never
		: never
	: never;

type DeclaredKeys<T> = keyof {
	// {} extends Record<K, 1> only for index signatures
	[
		K in keyof T as NonNullable<unknown> extends Record<K, 1> ? never : K
	]: T[K];
};

type OverlappingValues<T, K> = {
	[P in keyof T]-?: [PropertyName<K> & PropertyName<P>] extends [never]
		? never
		: [T[P]];
}[keyof T] extends infer Values
	? Values extends [infer Value]
		? Value
		: never
	: never;

type PropertyName<K> = K extends number ? `${K}` : K;

type ReplacedKeys<U> = keyof {
	// {} extends Pick<U, K> only when K is optional
	[K in keyof U as NonNullable<unknown> extends Pick<U, K> ? never : K]: U[K];
};

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
