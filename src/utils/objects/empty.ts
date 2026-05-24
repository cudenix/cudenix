/**
 * @module
 * Prototype-less empty object factory for hot-path allocations.
 *
 * Use {@link Empty} when you need a dictionary-like container that is safe to
 * use as a lookup table for arbitrary keys, or {@link FrozenEmpty} when you
 * need a shared read-only fallback for optional config parameters.
 */

/**
 * Allocate a fresh empty dictionary that does not inherit from
 * `Object.prototype`.
 *
 * Reach for this instead of `{}` when the object will be used as a lookup
 * table for arbitrary keys. Because `Object.prototype` is not in the lookup chain,
 * keys like `toString`, `hasOwnProperty`, or `__proto__` resolve to whatever
 * the caller wrote (or to `undefined`) instead of leaking inherited methods,
 * which keeps prototype-pollution surprises off the table.
 *
 * Behavior worth knowing before you call it:
 *
 * - **Constructor call required** — invoke with `new Empty()`. The export
 *   exists only as a typed constructor handle; calling it without `new`
 *   throws.
 * - **No `Object.prototype` methods** — `instance.hasOwnProperty(...)` and
 *   friends are not available on the result. Use `Object.hasOwn(instance,
 *   key)` or `key in instance` instead.
 * - **Fresh allocation** — every call returns an independent, mutable
 *   instance. Two calls never share state.
 *
 * @returns A fresh empty dictionary typed as `Record<PropertyKey, unknown>`.
 * @example
 * Build a header lookup that is safe even when the input contains keys named
 * after `Object.prototype` members.
 * ```typescript
 * const a = new Empty();
 *
 * a["p1"] = "v1";
 * a["p2"] = "v2";
 *
 * Object.hasOwn(a, "p1"); // true
 * ```
 * @example
 * Use it as an accumulator while parsing, without inherited keys getting in
 * the way of `in` checks.
 * ```typescript
 * const a = new Empty();
 *
 * for (let i = 0; i < 10; i++) {
 *   a[`key${i}`] = i;
 * }
 *
 * "key1" in a; // true
 * "v1" in a; // false
 * ```
 */
export const Empty = function Empty() {} as unknown as new () => Record<
	PropertyKey,
	unknown
>;

Empty.prototype = Object.create(null);

/**
 * Shared frozen empty dictionary, ready to use as a read-only fallback.
 *
 * Reach for this when a function accepts an optional options object and you
 * want the default to be an empty dictionary without allocating `{}` on every
 * call. Because the instance is frozen, callers cannot mutate it by accident —
 * any write throws a `TypeError` in strict mode (which is the default for
 * modules).
 *
 * Like {@link Empty}, this dictionary has no `Object.prototype` in its lookup
 * chain, so destructuring against arbitrary user-supplied keys is safe.
 *
 * @example
 * Skip the per-call `{}` allocation when destructuring an optional argument.
 * ```typescript
 * const fn = ({ a = "v1" }: { a?: string } = FrozenEmpty) => a;
 *
 * fn(); // "v1" — no allocation for the missing argument
 * ```
 * @example
 * Treat it as a sentinel for "no overrides provided" without forcing callers
 * to pass `undefined`.
 * ```typescript
 * const fn = (a: Record<string, unknown> = FrozenEmpty) => {
 *   // ...read-only consumption of a
 * };
 * ```
 */
export const FrozenEmpty = Object.freeze(new Empty());
