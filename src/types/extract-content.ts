/**
 * @module
 * Unwrap the value-shaped payload of a possibly function-typed content.
 */

/**
 * If `Content` is a function, resolve to the awaited return type; otherwise
 * resolve to `Content` itself.
 *
 * Lets a slot accept either a concrete value or a thunk / async factory and
 * normalize both to the eventual concrete type at the type level. The
 * function branch uses `...args: any[]` so the awaited return-type
 * extraction works regardless of the factory's parameter signature.
 *
 * @typeParam Content - Value, sync factory, or async factory to unwrap.
 * @example
 * ```typescript
 * type A = ExtractContent<{ a: true }>;             // { a: true }
 * type B = ExtractContent<() => { a: true }>;       // { a: true }
 * type C = ExtractContent<() => Promise<{ a: 1 }>>; // { a: 1 }
 * ```
 */
export type ExtractContent<Content> = Content extends (
	...args: any[]
) => infer Return
	? Awaited<Return>
	: Content;
