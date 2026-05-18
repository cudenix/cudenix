/**
 * @module
 * Hot-path empty-object factory.
 */

/**
 * Constructor that allocates empty dictionaries for hot-path use.
 *
 * Fresh instances start from the same constructor/prototype shape, which lets
 * mainstream JavaScript engines keep common property-access paths stable when
 * callers add keys consistently. As a second deliberate step, the constructor's
 * prototype is reassigned to an object whose own prototype is `null`.
 * Instances still inherit from `Empty.prototype`, but `Object.prototype` is
 * not in their lookup chain.
 *
 * @returns A fresh dictionary keyed by `PropertyKey` and valued as `unknown`.
 * @example
 * ```typescript
 * const map = new Empty(); // empty dictionary without Object.prototype lookup
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
