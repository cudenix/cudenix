/**
 * @module
 * Prototype-less empty object factory for safe dictionary use.
 */

/**
 * Create a fresh dictionary with no prototype — safe for untrusted keys like
 * `__proto__` or `toString`. Use it instead of `{}` for lookup tables. Must
 * be called with `new`.
 *
 * @example
 * ```typescript
 * const dictionary = new Empty();
 *
 * dictionary["b"] = "v1";
 * Object.hasOwn(dictionary, "b"); // true
 * ```
 */
export const Empty = function Empty() {} as unknown as new () => Record<
	PropertyKey,
	unknown
>;

Empty.prototype = Object.create(null);

/**
 * A shared, frozen empty dictionary — a read-only default for optional options
 * objects. Built on {@link Empty}.
 *
 * @example
 * ```typescript
 * const fn = ({ a = "v1" }: { a?: string } = FrozenEmpty) => a;
 *
 * fn(); // "v1"
 * ```
 */
export const FrozenEmpty = Object.freeze(new Empty());
