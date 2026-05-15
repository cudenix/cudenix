/**
 * @module
 * Conditional optionality based on whether a marker assigns to the value.
 */

/**
 * Make every key of `Type` optional whose value type is assignable from
 * `OptionalType`.
 *
 * The first mapped probe collects matching keys; the result is fed back
 * through `infer OptionalKey extends keyof Type` to recover them as a
 * `keyof` constraint. The final intersection rebuilds the object with the
 * matched keys re-declared via the `?` modifier while leaving the rest
 * untouched.
 *
 * Useful when a property may carry a sentinel (e.g. `undefined`, `never`)
 * that the caller should be able to omit altogether rather than supply
 * explicitly.
 *
 * @typeParam Type - Source object whose keys are inspected.
 * @typeParam OptionalType - Marker value: keys whose value is assignable
 *   from it become optional.
 * @example
 * ```typescript
 * type Source = { id: string; nickname: string | undefined };
 *
 * type Result = ConditionallyOptional<Source, undefined>;
 * // { id: string; nickname?: string | undefined }
 * ```
 */
export type ConditionallyOptional<
	Type extends Record<PropertyKey, unknown>,
	OptionalType,
> = {
	[Key in keyof Type]: OptionalType extends Type[Key] ? Key : never;
}[keyof Type] extends infer OptionalKey extends keyof Type
	? Omit<Type, OptionalKey> & {
			[Key in OptionalKey]?: Type[Key];
		}
	: never;
