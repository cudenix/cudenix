/**
 * @module
 * Type-level filter that drops keys whose value matches a marker.
 */

/**
 * Resolve to the union of keys in `T` whose value is mutually assignable
 * with `U`.
 *
 * The bidirectional `extends` check forces assignability in *both*
 * directions, not just one — so only structurally equal entries are picked.
 * Used internally by {@link ConditionallyOmit} to decide which keys to drop.
 *
 * @typeParam T - Object whose keys are inspected.
 * @typeParam U - Marker type a property's value must equal in order
 *   for its key to be selected.
 */
type OmitKeys<T extends object, U> = {
	[K in keyof T]: [T[K], U] extends [U, T[K]] ? K : never;
}[keyof T];

/**
 * Strip every key from `T` whose value is mutually assignable with
 * `U`.
 *
 * Useful for pruning sentinel-typed properties — for example, removing the
 * fields a builder marks as `never` or `unknown` so downstream consumers see
 * a tighter object shape.
 *
 * @typeParam T - Source object to filter.
 * @typeParam U - Value type whose owning keys are removed.
 * @example
 * ```typescript
 * type A = { a: string; b: never; c: number };
 *
 * type B = ConditionallyOmit<A, never>;
 * // { a: string; c: number }
 * ```
 */
export type ConditionallyOmit<T extends object, U> = Omit<T, OmitKeys<T, U>>;
