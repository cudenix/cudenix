/**
 * @module
 * Type-level counterpart to `Object.values` — collapse an object type into
 * the union of its value types.
 *
 * Use {@link ValueOf} when you need the union of value types declared in a
 * dictionary, for example to derive the allowed values of an enum-shaped
 * const object without restating each entry by hand.
 */

/**
 * Resolve to the union of every value type declared in `T`.
 *
 * Reach for this whenever you have an object type that behaves like an enum
 * or a lookup table and you want its value side as a union. It mirrors
 * `keyof T` — which returns the keys — but returns the values instead, so
 * the union stays in sync with the source dictionary as new entries are
 * added.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Every key contributes** — required, optional, and `readonly` properties
 *   all participate in the resulting union.
 * - **Literal types are preserved** — when the source uses `as const` or
 *   literal value annotations, the union keeps those literals rather than
 *   widening to `string`, `number`, etc.
 * - **Index signatures pass through** — a `Record<string, T>` collapses to
 *   `T`, since the value side of any string key is `T`.
 * - **Duplicate values collapse** — TypeScript unions deduplicate, so a
 *   dictionary whose values repeat resolves to a smaller union than the
 *   number of keys.
 *
 * @typeParam T - Object-shaped type whose value side is collapsed into a
 *   union. Must extend `object`.
 * @example
 * Pull the union of literal values out of an enum-shaped dictionary.
 * ```typescript
 * type A = { a: "v1"; b: "v2" };
 *
 * type B = ValueOf<A>;
 * // "v1" | "v2"
 * ```
 * @example
 * Works with arbitrary value types, including primitives and nested shapes.
 * ```typescript
 * type A = ValueOf<{ a: string; b: number }>;
 * // string | number
 *
 * type B = ValueOf<{ a: { id: 1 }; b: { id: 2 } }>;
 * // { id: 1 } | { id: 2 }
 * ```
 * @example
 * A `Record` index signature collapses to its value type.
 * ```typescript
 * type A = ValueOf<Record<string, "v1" | "v2">>;
 * // "v1" | "v2"
 * ```
 * @example
 * Repeated values deduplicate in the resulting union.
 * ```typescript
 * type A = ValueOf<{ a: "v1"; b: "v1"; c: "v2" }>;
 * // "v1" | "v2"
 * ```
 */
export type ValueOf<T extends object> = T[keyof T];
