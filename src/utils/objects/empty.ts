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

// new Empty() allocates faster than Object.create(null) and inherits no keys
Empty.prototype = Object.create(null);

// the prototype is shared by every dictionary, so freezing it keeps one poisoned
// instance from adding inherited keys to all of them; instances stay writable
// because the prototype carries no properties to shadow. benchmarks/objects
// measures this as free: allocation and writes are unchanged
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
