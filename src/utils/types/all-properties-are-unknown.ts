/**
 * Checks every property in one object-union branch.
 */
type AllPropertiesAreUnknownInBranch<T extends object> = {
	[K in keyof T]: unknown extends T[K] ? true : false;
	// "| undefined" covers optional properties
}[keyof T] extends true | undefined
	? true
	: false;

/**
 * Checks whether every property in every branch of an object union is unknown.
 *
 * @example
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: unknown; b: unknown }>; // true
 * type B = AllPropertiesAreUnknown<{ a: unknown; b: string }>; // false
 * type C = AllPropertiesAreUnknown<{ a: unknown } | { b: unknown }>; // true
 * type D = AllPropertiesAreUnknown<{ a: unknown } | { b: string }>; // false
 * ```
 */
export type AllPropertiesAreUnknown<T extends object> = false extends (
	T extends unknown
		? AllPropertiesAreUnknownInBranch<T>
		: never
)
	? false
	: true;
