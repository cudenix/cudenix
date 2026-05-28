/**
 * @module
 * Unwrap a value-or-factory slot to its resolved payload type.
 */

/**
 * Resolve `T` to the payload it produces — non-functions pass through, while a
 * factory collapses to its return type with any promise awaited (recursively,
 * so nested promises also unwrap).
 *
 * The function branch matches `(...args: any[])`, so factories of any arity
 * unwrap the same way. A bare `Promise<T>` (not wrapped in a factory) stays
 * untouched.
 *
 * @typeParam T - Value, sync factory, or async factory to extract from.
 * @example
 * ```typescript
 * type A = ExtractContent<{ a: "v1" }>; // { a: "v1" }
 * type B = ExtractContent<() => { a: "v1" }>; // { a: "v1" }
 * type C = ExtractContent<() => Promise<{ a: "v1" }>>; // { a: "v1" }
 * type D = ExtractContent<{ a: "v1" } | (() => { b: "v2" })>;
 * // { a: "v1" } | { b: "v2" }
 * ```
 */
export type ExtractContent<T> = T extends (...args: any[]) => infer Return
	? Awaited<Return>
	: T;
