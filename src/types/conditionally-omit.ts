/**
 * @module
 * Drop keys from an object type when their value type matches a marker.
 */

/**
 * Union of keys in `T` whose value type is mutually assignable with `U`.
 *
 * @typeParam T - Object whose keys are inspected.
 * @typeParam U - Marker type a property's value must equal for its key to be
 *   included.
 */
type OmitKeys<T extends object, U> = {
	[K in keyof T]: [T[K], U] extends [U, T[K]] ? K : never;
}[keyof T];

/**
 * Remove every key from `T` whose value type is mutually assignable with `U`.
 * Useful for stripping sentinel slots (typed as `never`, `unknown`, or a
 * marker) out of a builder-generated object before exposing it.
 *
 * Wider supertypes and narrower subtypes of `U` survive — only an exact
 * structural twin is dropped. Optional and `readonly` modifiers carry through
 * on retained keys.
 *
 * @typeParam T - Source object whose keys are filtered.
 * @typeParam U - Marker type whose mutually-assignable keys are removed.
 * @example
 * ```typescript
 * type A = ConditionallyOmit<{ a: string; b: never; c: number }, never>;
 * // { a: string; c: number }
 *
 * type B = ConditionallyOmit<{ a: "v1"; b: string }, "v1">;
 * // { b: string }
 * ```
 */
export type ConditionallyOmit<T extends object, U> = Omit<T, OmitKeys<T, U>>;
