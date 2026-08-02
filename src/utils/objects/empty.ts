/**
 * Creates dictionary objects that inherit no keys.
 *
 * @example
 * ```typescript
 * const dictionary = new Empty();
 *
 * dictionary["b"] = "v1";
 * Object.hasOwn(dictionary, "b"); // true
 * "toString" in dictionary; // false
 * ```
 */
export const Empty = function Empty() {} as unknown as new () => Record<
	PropertyKey,
	unknown
>;

// instances inherit no keys
Empty.prototype = Object.create(null);

Object.freeze(Empty.prototype);

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
