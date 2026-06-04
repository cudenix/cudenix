/**
 * @module
 * Check whether every property of an object type carries the value type
 * `unknown`.
 */

/**
 * Resolve to `true` when every property of `T` is typed as `unknown`,
 * otherwise `false`. Use it to detect "untouched" generics — for example, to
 * pick a default branch when a validator schema was never supplied.
 *
 * - Empty objects resolve to `true` (vacuously unrefined).
 * - `any` is treated like `unknown`.
 * - A single concrete value type — including narrow unions, `null`,
 *   `undefined`, or `never` — flips the result to `false`.
 * - Tuples and arrays always resolve to `false` because their synthetic
 *   members (`length`, numeric indices) carry concrete types.
 * - A union of object types with disjoint keys resolves to `true` (its `keyof`
 *   collapses to `never`); pass a single object shape, as the intended
 *   schema-detection use always does.
 *
 * @typeParam T - Object-shaped type whose property value types are inspected.
 * @example
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: unknown; b: unknown }>; // true
 * type B = AllPropertiesAreUnknown<Record<string, unknown>>; // true
 * type C = AllPropertiesAreUnknown<{ a: unknown; b: string }>; // false
 * type D = AllPropertiesAreUnknown<[unknown, unknown]>; // false
 * ```
 */
export type AllPropertiesAreUnknown<T extends object> = {
	[K in keyof T]: unknown extends T[K] ? true : false;
}[keyof T] extends true | undefined
	? true
	: false;
