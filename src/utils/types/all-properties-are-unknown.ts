/**
 * Checks every property in one object-union branch.
 */
type AllPropertiesAreUnknownInBranch<T extends object> = keyof {
	[K in keyof T as unknown extends T[K] ? never : K]: T[K];
} extends never
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
