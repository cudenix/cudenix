/**
 * Resolve to the value `T` produces, awaiting a factory's return.
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
