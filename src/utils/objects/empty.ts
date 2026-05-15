/**
 * @module
 * Prototype-less object factory.
 */

/**
 * Constructor that produces a plain dictionary with a `null` prototype.
 *
 * Instances skip `Object.prototype`, so well-known keys such as
 * `__proto__`, `toString` or `hasOwnProperty` cannot collide with user data
 * and lookups stay on a fast monomorphic shape. Prefer it over
 * `Object.create(null)` when the same shape is allocated repeatedly inside a
 * hot path.
 *
 * @returns A fresh dictionary keyed by `PropertyKey` and valued as `unknown`.
 * @example
 * ```typescript
 * const map = new Empty();
 *
 * map["__proto__"] = "safe"; // own property, not the prototype
 * map["toString"]; // undefined — no inherited members
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
 * Use it as a zero-allocation sentinel whenever a function must return an
 * empty dictionary that callers will not mutate.
 *
 * @example
 * ```typescript
 * const cookies = header ? parseCookies(header) : FreezeEmpty;
 * ```
 */
export const FreezeEmpty = Object.freeze(new Empty());
