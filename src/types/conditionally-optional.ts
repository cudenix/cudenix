/**
 * @module
 * Conditional optionality based on whether a marker assigns to the value.
 */

/**
 * Make every key of `T` optional whose value type is assignable from
 * `U`.
 *
 * The first mapped probe collects matching keys; the result is fed back
 * through `infer OptionalKey extends keyof T` to recover them as a
 * `keyof` constraint. The final intersection rebuilds the object with the
 * matched keys re-declared via the `?` modifier while leaving the rest
 * untouched. The `-?` on the probe strips optionality from the mapped
 * type so source keys already declared as optional are still collected —
 * otherwise indexing the probe via `[keyof T]` would inject `undefined`
 * into the union and the `infer ... extends keyof T` constraint would
 * fail, collapsing the whole result to `never`.
 *
 * Useful when a property may carry a sentinel (e.g. `undefined`, `never`)
 * that the caller should be able to omit altogether rather than supply
 * explicitly.
 *
 * @typeParam T - Source object whose keys are inspected.
 * @typeParam U - Marker value: keys whose value is assignable
 *   from it become optional.
 * @example
 * ```typescript
 * type A = { a: string; b: string | undefined };
 *
 * type B = ConditionallyOptional<A, undefined>;
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
