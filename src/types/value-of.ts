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
 * type Status = { ready: "ready"; done: "done" };
 *
 * type A = ValueOf<Status>;
 * // "ready" | "done"
 *
 * type B = ValueOf<{ id: string; count: number }>;
 * // string | number
 * ```
 */
export type ValueOf<Type extends object> = Type[keyof Type];
