/**
 * @module
 * Unwrap a value-or-factory slot to its resolved payload type.
 */

/**
 * Resolve `T` to the value it produces: a plain value passes through, while a
 * factory collapses to its return type with any promise awaited.
 *
 * @example
 * ```typescript
 * type A = ExtractContent<{ a: "v1" }>; // { a: "v1" }
 * type B = ExtractContent<() => Promise<{ a: "v1" }>>; // { a: "v1" }
 * ```
 */
export type ExtractContent<T> = T extends (...args: any[]) => infer Return
	? Awaited<Return>
	: T;
