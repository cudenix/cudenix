/**
 * @module
 * Type-level filter that drops keys whose value matches a marker.
 */

/**
 * Resolve to the union of keys in `Type` whose value is mutually assignable
 * with `OmitType`.
 *
 * The bidirectional `extends` check forces assignability in *both*
 * directions, not just one — so only structurally equal entries are picked.
 * Used internally by {@link ConditionallyOmit} to decide which keys to drop.
 *
 * @typeParam Type - Object whose keys are inspected.
 * @typeParam OmitType - Marker type a property's value must equal in order
 *   for its key to be selected.
 */
type OmitKeys<Type, OmitType> = {
	[Key in keyof Type]: [Type[Key], OmitType] extends [OmitType, Type[Key]]
		? Key
		: never;
}[keyof Type];

/**
 * Strip every key from `Type` whose value is mutually assignable with
 * `OmitType`.
 *
 * Useful for pruning sentinel-typed properties — for example, removing the
 * fields a builder marks as `never` or `unknown` so downstream consumers see
 * a tighter object shape.
 *
 * @typeParam Type - Source object to filter.
 * @typeParam OmitType - Value type whose owning keys are removed.
 * @example
 * ```typescript
 * type A = { a: string; b: never; c: number };
 *
 * type B = ConditionallyOmit<A, never>;
 * // { a: string; c: number }
 * ```
 */
export type ConditionallyOmit<Type extends object, OmitType> = Omit<
	Type,
	OmitKeys<Type, OmitType>
>;
