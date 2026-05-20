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
 * const status = { ready: "ready", done: "done" } as const;
 *
 * type Status = ValueOf<typeof status>;
 * // "ready" | "done"
 * ```
 */
export type ValueOf<Type extends object> = Type[keyof Type];
