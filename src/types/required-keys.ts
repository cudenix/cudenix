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
 * The `-?` modifier strips optionality from the mapped output. Without it,
 * an optional source key would survive as an optional key in the probe
 * and contribute an implicit `undefined` to the final indexed-access union,
 * which would then leak into the result alongside the legitimate key
 * names.
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
export type RequiredKeys<Type extends object> = {
	[Key in keyof Type]-?: undefined extends Type[Key] ? never : Key;
}[keyof Type];
