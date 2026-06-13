/**
 * @module
 * Check whether every property of an object type is typed `unknown`.
 */

/**
 * Resolve to `true` when every property of `T` is typed `unknown`, else
 * `false`. Useful for detecting an untouched generic, e.g. a schema that was
 * never supplied.
 *
 * @example
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: unknown; b: unknown }>; // true
 * type B = AllPropertiesAreUnknown<{ a: unknown; b: string }>; // false
 * ```
 */
export type AllPropertiesAreUnknown<T extends object> = {
	[K in keyof T]: unknown extends T[K] ? true : false;
}[keyof T] extends true | undefined
	? true
	: false;
