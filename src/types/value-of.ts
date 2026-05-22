/**
 * @module
 * Type-level `Object.values`.
 */

/**
 * Resolve to the union of every value type in `Type`.
 *
 * Counterpart to `keyof Type` — where the latter returns the keys, this
 * returns the value side, useful for converting an enum-shaped object into
 * the union of its possible values.
 *
 * @typeParam Type - Dictionary whose value types are unioned.
 * @example
 * ```typescript
 * type A = { a: "v1"; b: "v2" };
 *
 * type B = ValueOf<A>;
 * // "v1" | "v2"
 *
 * type C = ValueOf<{ a: string; b: number }>;
 * // string | number
 * ```
 */
export type ValueOf<Type extends object> = Type[keyof Type];
