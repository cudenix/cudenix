/**
 * @module
 * Fast empty-object factory tuned for hot paths.
 */

/**
 * Constructor that allocates empty dictionaries faster than `{}`.
 *
 * All instances share the same hidden class, so the engine keeps property
 * accesses on a monomorphic inline-cache path instead of paying the
 * polymorphic cost that grows out of repeated `{}` literals. The `null`
 * prototype is a side effect of the technique — it removes the
 * `Object.prototype` lookup chain, which trims a few extra cycles per miss.
 *
 * @returns A fresh dictionary keyed by `PropertyKey` and valued as `unknown`.
 * @example
 * ```typescript
 * const map = new Empty(); // faster than `const map = {}` in tight loops
 * ```
 */
export const Empty = function Empty() {} as unknown as new () => Record<
	PropertyKey,
	unknown
>;

Empty.prototype = Object.create(null);

/**
 * Shared frozen instance of {@link Empty}.
 *
 * Reuses a single allocation as a sentinel for callers that need an empty
 * dictionary but will not mutate it, avoiding the per-call cost of `{}` or
 * `new Empty()` entirely.
 *
 * @example
 * ```typescript
 * const fn = ({ debug = false }: FnOptions = FreezeEmpty) => {
 * 	// `debug` falls back to its default without allocating `{}` per call.
 * };
 * ```
 */
export const FreezeEmpty = Object.freeze(new Empty());
