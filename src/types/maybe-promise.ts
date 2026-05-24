/**
 * @module
 * Type-level sync-or-async union — express a value that may arrive directly
 * or wrapped in a promise without forcing every caller to commit to one shape
 * or the other.
 *
 * Use {@link MaybePromise} on framework seams that accept user-supplied
 * callbacks — handlers, middleware, hooks, lifecycle functions — where the
 * implementer should be free to return either a plain value or a `Promise`,
 * and the consuming code awaits the result uniformly.
 */

/**
 * Resolve to the union of `T` and `Promise<T>`, so a value of this type can
 * be produced synchronously or asynchronously without changing its declared
 * shape.
 *
 * Reach for this whenever an API contract should accept either a direct value
 * or a promise that eventually settles to one — handler return types, plugin
 * hook signatures, middleware factories, lazy config providers, or any seam
 * where the framework awaits the result so the caller never has to pick a
 * side. Because `await` is a no-op on non-promise values, the consumer can
 * write `const v = await fn();` and stay correct whether the producer chose
 * sync or async.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Plain `T` is preserved alongside `Promise<T>`** — the union keeps the
 *   synchronous branch intact, so callers that need to distinguish the two
 *   can still narrow with `instanceof Promise` or `Promise.resolve` to
 *   coerce.
 * - **`Awaited` strips the wrapper cleanly** — `Awaited<MaybePromise<T>>`
 *   collapses to `T`, so downstream types that consume the resolved value do
 *   not have to special-case the promise branch.
 * - **Distributes over unions in `T`** — a `MaybePromise<A | B>` resolves to
 *   `A | B | Promise<A | B>`, not to `MaybePromise<A> | MaybePromise<B>`. The
 *   promise wraps the entire value union as a single async branch.
 * - **`undefined` and `null` are not added** — only the promise branch is
 *   layered on. If the producer may also return nothing, include `undefined`
 *   or `null` in `T` explicitly.
 * - **Nested `MaybePromise` does not auto-flatten** — wrapping a
 *   `MaybePromise<T>` in another `MaybePromise` yields
 *   `MaybePromise<T> | Promise<MaybePromise<T>>`. Apply `Awaited` if you need
 *   the fully unwrapped value type.
 * - **Works with any value shape** — primitives, objects, arrays, tuples, and
 *   function types all flow through unchanged, so the same alias covers every
 *   callback return type in a framework surface.
 *
 * @typeParam T - Value type that may also arrive as a `Promise<T>`. Any type
 *   is accepted, including unions, primitives, and complex object shapes.
 * @example
 * Express a callback return that may resolve synchronously or asynchronously,
 * so the implementer is free to choose either shape without changing the
 * signature.
 * ```typescript
 * type A = MaybePromise<number>;
 * // number | Promise<number>
 *
 * type B = MaybePromise<string>;
 * // string | Promise<string>
 * ```
 * @example
 * Apply `Awaited` to recover the resolved value type — useful when the
 * consumer only cares about the settled result and not the wire shape.
 * ```typescript
 * type A = Awaited<MaybePromise<number>>;
 * // number
 *
 * type B = Awaited<MaybePromise<{ a: 1 }>>;
 * // { a: 1 }
 * ```
 * @example
 * Unions inside `T` are wrapped as a whole, not distributed across separate
 * promise branches.
 * ```typescript
 * type A = MaybePromise<number | undefined>;
 * // number | undefined | Promise<number | undefined>
 *
 * type B = MaybePromise<"v1" | "v2">;
 * // "v1" | "v2" | Promise<"v1" | "v2">
 * ```
 * @example
 * Object and function shapes flow through unchanged, which makes the alias
 * suitable for handler and middleware return types alike.
 * ```typescript
 * type A = MaybePromise<{ a: string; b: number }>;
 * // { a: string; b: number } | Promise<{ a: string; b: number }>
 *
 * type B = MaybePromise<(a: string) => boolean>;
 * // ((a: string) => boolean) | Promise<(a: string) => boolean>
 * ```
 */
export type MaybePromise<T> = T | Promise<T>;
