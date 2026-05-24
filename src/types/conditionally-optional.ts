/**
 * @module
 * Type-level conditional optional — relax the keys of an object whose value
 * type already admits a given marker.
 *
 * Use {@link ConditionallyOptional} to turn properties that may carry a
 * sentinel (typically `undefined` or `null`) into truly optional ones, so
 * callers can omit them altogether instead of being forced to write the
 * sentinel explicitly.
 */

/**
 * Resolve to a copy of `T` where every key whose value type is assignable
 * from `U` is re-declared with the `?` modifier, while the rest stay
 * exactly as they were.
 *
 * Reach for this whenever an object type was authored with explicit
 * `| undefined` (or another sentinel) on some fields and you want the
 * derived shape to mark those fields as truly optional — saving callers
 * from typing `undefined` by hand, lining up with how default-value
 * destructuring works, or generating an input type whose optional keys
 * mirror what the runtime actually treats as skippable.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Direction of the check is "marker fits into value"** — a key is
 *   relaxed when the marker assigns *into* its value type, not the other
 *   way around. A field typed as `string` is relaxed by the marker `"v1"`
 *   (because `"v1"` assigns to `string`), but a field typed as `"v1"` is
 *   not relaxed by the marker `string`.
 * - **Already-optional source keys are preserved** — keys declared with
 *   `?` in `T` carry `undefined` in their value type, so an `undefined`
 *   marker keeps them optional in the result instead of collapsing them
 *   to required.
 * - **`readonly` is preserved per key** — a key promoted to optional
 *   keeps the `readonly` modifier it had in `T`.
 * - **Unmatched keys pass through untouched** — keys whose value type
 *   does not admit `U` keep their original modifiers and value type
 *   verbatim, including the original optionality.
 * - **`unknown`-valued keys are always relaxed** — any marker is
 *   assignable to `unknown`, so a key typed as `unknown` ends up
 *   optional regardless of which marker you pass.
 * - **`never`-valued keys are never relaxed** — no non-`never` marker is
 *   assignable to `never`, so those keys stay as they were.
 * - **A `never` marker is a no-op** — the assignability check distributes
 *   over `never` and collapses to the empty case, so the result is
 *   structurally identical to `T`.
 * - **Union markers distribute** — when `U` is a union, the check runs
 *   per member, so a key is relaxed if *any* member of the union is
 *   assignable to its value type.
 * - **Index signatures pass through when their value rejects the marker** —
 *   a `Record<string, V>` whose `V` does not admit `U` is returned as-is,
 *   because the probe collects no concrete key to promote.
 *
 * @typeParam T - Source object whose keys are inspected. Must extend
 *   `object`.
 * @typeParam U - Marker value: keys whose value type is assignable from
 *   it are re-declared as optional.
 * @example
 * Relax keys whose value already admits `undefined`, so callers can omit
 * them instead of passing the sentinel explicitly.
 * ```typescript
 * type A = { a: string; b: string | undefined };
 *
 * type B = ConditionallyOptional<A, undefined>;
 * // { a: string; b?: string | undefined }
 * ```
 * @example
 * The check runs per key, so an object with several `| undefined` fields
 * gets each of them relaxed independently while strict ones stay required.
 * ```typescript
 * type A = {
 *   a: string | undefined;
 *   b: number | undefined;
 *   c: boolean;
 * };
 *
 * type B = ConditionallyOptional<A, undefined>;
 * // { a?: string | undefined; b?: number | undefined; c: boolean }
 * ```
 * @example
 * Any value type that admits the marker is fair game — `null`, literal
 * markers, and union markers all work the same way.
 * ```typescript
 * type A = ConditionallyOptional<{ a: string | null; b: number }, null>;
 * // { a?: string | null; b: number }
 *
 * type B = ConditionallyOptional<{ a: boolean; b: "v1" | "v2" }, "v1">;
 * // { a: boolean; b?: "v1" | "v2" }
 * ```
 * @example
 * The `readonly` modifier on a promoted key is preserved.
 * ```typescript
 * type A = ConditionallyOptional<
 *   { readonly a: string | undefined; b: number | undefined },
 *   undefined
 * >;
 * // { readonly a?: string | undefined; b?: number | undefined }
 * ```
 * @example
 * A key whose value is a strict subtype of the marker is not relaxed,
 * because the marker does not fit into that narrower value type.
 * ```typescript
 * type A = ConditionallyOptional<{ a: "v1"; b: string }, string>;
 * // { a: "v1"; b?: string }
 * ```
 */
export type ConditionallyOptional<T extends object, U> = {
	[K in keyof T]-?: U extends T[K] ? K : never;
}[keyof T] extends infer UK extends keyof T
	? Omit<T, UK> & {
			[K in UK]?: T[K];
		}
	: never;
