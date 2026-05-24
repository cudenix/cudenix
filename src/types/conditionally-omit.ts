/**
 * @module
 * Type-level structural filter — drop keys from an object type when their
 * value type is mutually assignable with a marker.
 *
 * Use {@link ConditionallyOmit} to prune sentinel-typed properties out of a
 * generated object shape — removing the slots a builder marks with `never`,
 * `unknown`, or another placeholder so downstream consumers see a tight,
 * clean type instead of the placeholder-laden intermediate one.
 */

/**
 * Resolve to the union of keys in `T` whose value type is mutually assignable
 * with `U`.
 *
 * Internal helper used by {@link ConditionallyOmit} to decide which keys
 * should be dropped from the source object. The bidirectional `extends` check
 * forces assignability in *both* directions, so only structurally equal
 * entries are selected — a wider supertype or narrower subtype of `U` is
 * left alone.
 *
 * @typeParam T - Object whose keys are inspected.
 * @typeParam U - Marker type a property's value must equal for its key to be
 *   included in the union.
 */
type OmitKeys<T extends object, U> = {
	[K in keyof T]: [T[K], U] extends [U, T[K]] ? K : never;
}[keyof T];

/**
 * Resolve to a type that carries every key from `T` except those whose value
 * type is mutually assignable with `U`.
 *
 * Reach for this whenever you have a builder-generated or otherwise computed
 * object type that uses sentinel value types — `never`, `unknown`, or a
 * branded marker — to flag slots a downstream consumer should not see, and
 * you want to strip those slots out before exposing the result. Because the
 * match is bidirectional, only keys whose value type is exactly `U` are
 * removed; a wider supertype or a narrower subtype of `U` stays put.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Mutual assignability is required** — a key is dropped only when its
 *   value type and `U` are assignable to each other in both directions. A
 *   wider supertype or a narrower subtype of `U` survives the filter.
 * - **Sentinel markers are the common case** — `never`, `unknown`, `null`,
 *   and `undefined` cover almost every real-world use, since they are the
 *   easiest values to declare as placeholders.
 * - **`any` matches every key** — `any` is mutually assignable with every
 *   type, so a marker of `any` strips the object empty, and an `any`-valued
 *   key is dropped by any marker you point at it.
 * - **Index signatures are filtered the same way** — a `Record<string, T>`
 *   whose value type matches `U` collapses to the empty object.
 * - **Optional and `readonly` modifiers survive** — keys that pass the
 *   filter keep their original `?` and `readonly` declarations.
 * - **Optional `never` keys are not removed** — indexed access widens
 *   `b?: never` to `never | undefined`, which is no longer mutually
 *   assignable with `never`, so the key survives the filter.
 * - **Empty objects pass through** — with no keys to inspect, the result is
 *   the empty object.
 *
 * @typeParam T - Source object whose keys are filtered. Must extend `object`.
 * @typeParam U - Marker type whose mutually-assignable keys are removed.
 * @example
 * Strip placeholder `never` slots out of a generated object shape so the
 * exposed type only carries the keys with usable values.
 * ```typescript
 * type A = { a: string; b: never; c: number };
 *
 * type B = ConditionallyOmit<A, never>;
 * // { a: string; c: number }
 * ```
 * @example
 * The match is mutual, so a wider or narrower value type stays untouched —
 * only an exact structural twin of the marker is dropped.
 * ```typescript
 * type A = { a: "v1"; b: string };
 *
 * type B = ConditionallyOmit<A, "v1">;
 * // { b: string }
 *
 * type C = ConditionallyOmit<A, string>;
 * // { a: "v1" }
 * ```
 * @example
 * Optional and `readonly` modifiers carry through to the retained keys.
 * ```typescript
 * type A = { a: never; b?: string; readonly c: number };
 *
 * type B = ConditionallyOmit<A, never>;
 * // { b?: string; readonly c: number }
 * ```
 * @example
 * An `any` marker collapses the source to an empty object, while an
 * `any`-typed value is dropped by every marker.
 * ```typescript
 * type A = ConditionallyOmit<{ a: string; b: number }, any>;
 * // {}
 *
 * type B = ConditionallyOmit<{ a: any; b: number }, string>;
 * // { b: number }
 * ```
 */
export type ConditionallyOmit<T extends object, U> = Omit<T, OmitKeys<T, U>>;
