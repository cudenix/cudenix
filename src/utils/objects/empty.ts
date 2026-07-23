/**
 * Creates prototype-free dictionary objects.
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

// new Empty() allocates faster than Object.create(null) while behaving the same (no inherited keys)
Empty.prototype = Object.create(null);

/**
 * Provides a reusable immutable empty dictionary.
 *
 * @example
 * ```typescript
 * const fn = ({ a = "v1" }: { a?: string } = FrozenEmpty) => a;
 *
 * fn(); // "v1"
 * ```
 */
export const FrozenEmpty = Object.freeze(new Empty());
