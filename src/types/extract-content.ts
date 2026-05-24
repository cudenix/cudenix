/**
 * @module
 * Type-level content unwrapper — collapse a value-or-factory slot into the
 * concrete payload it ultimately produces.
 *
 * Use {@link ExtractContent} when a route, option, or slot accepts either a
 * concrete value, a sync factory, or an async factory, and you want a single
 * type that describes the resolved payload regardless of which form the
 * caller chose.
 */

/**
 * Resolve to the payload type produced by `T`, awaiting any promise the
 * factory may return and passing non-function inputs through unchanged.
 *
 * Reach for this whenever a slot — a default value, a route response, a
 * config field — accepts either a concrete shape, a sync factory, or an
 * async factory, and you want a single type that talks about the eventual
 * payload without caring which form the caller picked. Because the function
 * branch matches on `...args: any[]`, factories of any arity collapse the
 * same way, and because the return is run through `Awaited<...>`, nested
 * promises unwrap all the way down to their final value.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Non-function inputs pass through** — when `T` is not a function type,
 *   the result is `T` unchanged. A bare `Promise<Value>` stays wrapped
 *   because the helper only awaits inside the factory branch.
 * - **Sync factories collapse to their return type** — a `() => Value`
 *   resolves to `Value`.
 * - **Async factories are awaited** — a function returning `Promise<Value>`
 *   resolves to `Value`. The unwrapping is recursive, so deeply nested
 *   promises also collapse to their final payload.
 * - **Any parameter signature works** — the function branch matches on
 *   `...args: any[]`, so factories with any arity or argument types unwrap
 *   the same way.
 * - **Distributes over unions** — when `T` is a union of value and factory
 *   branches, the result is the union of each branch's resolution.
 *
 * @typeParam T - Value, sync factory, or async factory whose payload is
 *   extracted.
 * @example
 * A non-function input passes through unchanged.
 * ```typescript
 * type A = ExtractContent<{ a: "v1" }>;
 * // { a: "v1" }
 * ```
 * @example
 * A sync factory collapses to its return type, and an async factory has its
 * promise awaited.
 * ```typescript
 * type A = ExtractContent<() => { a: "v1" }>;
 * // { a: "v1" }
 *
 * type B = ExtractContent<() => Promise<{ a: "v1" }>>;
 * // { a: "v1" }
 * ```
 * @example
 * The factory's parameter signature does not affect the unwrap — any arity
 * or argument shape resolves the same way.
 * ```typescript
 * type A = ExtractContent<(a: number, b: string) => { a: "v1" }>;
 * // { a: "v1" }
 * ```
 * @example
 * Nested promises collapse all the way down to the final payload.
 * ```typescript
 * type A = ExtractContent<() => Promise<Promise<{ a: "v1" }>>>;
 * // { a: "v1" }
 * ```
 * @example
 * A union of value and factory branches distributes, producing the union of
 * each side's resolution.
 * ```typescript
 * type A = ExtractContent<{ a: "v1" } | (() => { b: "v2" })>;
 * // { a: "v1" } | { b: "v2" }
 * ```
 */
export type ExtractContent<T> = T extends (...args: any[]) => infer Return
	? Awaited<Return>
	: T;
