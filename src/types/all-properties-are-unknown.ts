/**
 * @module
 * Predicate that reports whether every property in `Type` is typed as `unknown`.
 */

/**
 * Resolve to `true` when every property of `Type` has type `unknown`,
 * otherwise `false`.
 *
 * The mapped type rewrites each member to the literal `true` or `false`
 * depending on whether `unknown` is assignable to the value type. The
 * resulting union is then collapsed: if the only members are `true` — or
 * `undefined`, which appears when `Type` has no keys at all — the predicate
 * succeeds.
 *
 * Useful as a sentinel for detecting completely-unrefined generics, e.g.
 * picking a default branch when a validator schema was never supplied.
 *
 * @typeParam Type - Object type whose property types are inspected.
 * @example
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: unknown; b: unknown }>; // true
 * type B = AllPropertiesAreUnknown<{ a: unknown; b: string }>;  // false
 * type C = AllPropertiesAreUnknown<{}>;                          // true
 * ```
 */
export type AllPropertiesAreUnknown<Type> = {
	[Key in keyof Type]: unknown extends Type[Key] ? true : false;
}[keyof Type] extends true | undefined
	? true
	: false;
