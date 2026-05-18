/**
 * @module
 * Hot-path empty-object factory.
 */

/**
 * Constructor that allocates empty dictionaries quickly in most hot paths.
 *
 * All instances share the same hidden class, so the engine can keep property
 * accesses on a monomorphic inline-cache path instead of the polymorphic path
 * that can grow out of repeated `{}` literals. The constructor prototype has a
 * `null` prototype as a side effect of the technique — it removes the
 * `Object.prototype` lookup chain, which can trim a few extra cycles per miss.
 *
 * @returns A fresh dictionary keyed by `PropertyKey` and valued as `unknown`.
 * @example
 * ```typescript
 * const map = new Empty(); // usually faster than `{}` in tight loops
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
