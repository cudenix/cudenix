/**
 * @module
 * Prototype-less empty object factory for safe dictionary use.
 */

/**
 * Allocate a fresh empty dictionary that does not inherit from
 * `Object.prototype`. Use it instead of `{}` for lookup tables — keys like
 * `toString`, `hasOwnProperty`, or `__proto__` resolve to whatever the caller
 * wrote (or `undefined`) instead of leaking inherited methods.
 *
 * Must be invoked with `new`. Use `Object.hasOwn(instance, key)` or
 * `key in instance` for membership checks since prototype methods are absent.
 *
 * @returns A fresh empty dictionary typed as `Record<PropertyKey, unknown>`.
 * @example
 * ```typescript
 * const a = new Empty();
 *
 * a["p1"] = "v1";
 *
 * Object.hasOwn(a, "p1"); // true
 * ```
 */
export const Empty = function Empty() {} as unknown as new () => Record<
	PropertyKey,
	unknown
>;

Empty.prototype = Object.create(null);

/**
 * Shared frozen empty dictionary, ready to use as a read-only fallback for
 * optional options objects. Skips the per-call `{}` allocation; mutation
 * attempts throw a `TypeError` in strict mode. Built on {@link Empty}, so
 * prototype-free destructuring is safe.
 *
 * @example
 * ```typescript
 * const fn = ({ a = "v1" }: { a?: string } = FrozenEmpty) => a;
 *
 * fn(); // "v1" — no allocation for the missing argument
 * ```
 */
export const FrozenEmpty = Object.freeze(new Empty());
