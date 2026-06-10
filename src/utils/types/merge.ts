/**
 * @module
 * Type-level shallow merge — overlay an overrides type onto a base type,
 * mirroring the key-copy semantics of the runtime object merge.
 */

/**
 * Union of `U`'s keys that are certainly present on a value of `U` — declared
 * without `?` and not introduced by an index signature. Only these keys are
 * guaranteed to be copied by the runtime merge, so only they replace the base
 * declaration wholesale.
 */
type ReplacedKeys<U> = {
	[K in keyof U]-?: NonNullable<unknown> extends Pick<U, K> ? never : K;
}[keyof U];

/**
 * Carry every key from `T`, replacing any key also declared in `U` by `U`'s
 * declaration exactly when the runtime merge would overwrite it. Unlike
 * `T & U`, a replaced key takes `U`'s value type cleanly instead of being
 * intersected with the original.
 *
 * Mirrors the runtime object merge (`for...in` copy of `U`'s enumerable
 * string keys into `T`), so the non-obvious cases follow the value-level
 * behavior rather than blanket replacement:
 *
 * - Unions distribute: a union in either operand merges per branch instead of
 *   collapsing into an intersection.
 * - A key declared optionally in `U` — or reachable only through an index
 *   signature — may or may not be copied, so an overlapping key resolves to
 *   `T[K] | U[K]`.
 * - Symbol keys of `U` are dropped (`for...in` never visits them); symbol
 *   keys of `T` survive untouched.
 * - Shallow: overlapping nested object keys are replaced wholesale, not
 *   merged recursively. Optionality and `readonly` follow the winning side
 *   per key.
 *
 * @typeParam T - Base shape whose keys are inherited unless overridden.
 * @typeParam U - Overrides shape applied on top of `T`.
 * @example
 * ```typescript
 * type A = Merge<{ a: string; b: number }, { b: boolean; c: string }>;
 * // { a: string; b: boolean; c: string }
 *
 * type B = Merge<{ a: string }, { a: number } | { b: number }>;
 * // Merge<{ a: string }, { a: number }> | Merge<{ a: string }, { b: number }>
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
