/**
 * @module
 * Type-level required-key selector.
 */

/**
 * Resolve to the union of keys in `Type` whose values cannot be `undefined`.
 *
 * Mirrors the runtime distinction between "must provide" and "may omit"
 * properties: a key whose type permits `undefined` — either because it is
 * declared with `?` or because the value type itself includes `undefined`
 * — is treated as optional and excluded from the result.
 *
 * The `-?` modifier strips optionality from every key during the probe so
 * the mapped type sees the *value* type, not the implicit `T | undefined`
 * that optional members would otherwise carry.
 *
 * @typeParam Type - Object type whose keys are partitioned.
 * @example
 * ```typescript
 * type Source = { name: string; nickname?: string; age: number | undefined };
 *
 * type Required = RequiredKeys<Source>;
 * // "name"
 * ```
 */
export type RequiredKeys<Type extends Record<PropertyKey, unknown>> = {
	[Key in keyof Type]-?: undefined extends Type[Key] ? never : Key;
}[keyof Type];
