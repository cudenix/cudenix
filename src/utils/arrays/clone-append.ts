/**
 * @module
 * Allocate a new array that extends an existing one with a single element.
 *
 * Use {@link cloneAppend} when you need a fresh array containing the contents
 * of a source array followed by one more item, without mutating the source or
 * paying the spread/concat overhead on hot paths.
 */

/**
 * Return a new array containing every element of `array` followed by `item`.
 *
 * Reach for this when you are growing an immutable list — pushing onto a
 * middleware chain, an accumulator inside a reducer, or any structure that
 * should not see its previous reference mutated. The shape matches
 * `[...array, item]`, but the helper avoids the iterator protocol that the
 * spread operator walks and skips the spreadable-aware behavior of
 * `Array.prototype.concat`.
 *
 * Behavior worth knowing before you call it:
 *
 * - **Immutable** — the source `array` is never touched. The result is a
 *   freshly allocated array; callers can keep using the original reference
 *   without worrying about side effects.
 * - **Single-element append** — `item` is always added as one element. Unlike
 *   `array.concat(item)`, an `item` that happens to be an array (or any
 *   concat-spreadable value) is stored as-is at the tail instead of being
 *   flattened.
 * - **Shallow copy** — element references are copied as-is. Mutating an
 *   object reachable through the returned array also mutates it through the
 *   original.
 * - **Pre-sized allocation** — the result is allocated once at the final
 *   length, so there is no incremental resizing as elements are copied
 *   across.
 *
 * @typeParam T - Element type shared by the source array and the appended
 *   item.
 * @param array - Source array to clone. Left untouched.
 * @param item - Element appended at the end of the returned array.
 * @returns A freshly allocated array of length `array.length + 1`.
 * @example
 * Append onto an empty, single-element, or longer array.
 * ```typescript
 * cloneAppend([], "a"); // ["a"]
 * cloneAppend(["a"], "b"); // ["a", "b"]
 * cloneAppend(["a", "b"], "c"); // ["a", "b", "c"]
 * ```
 * @example
 * The source array is never mutated, so the original reference keeps its
 * previous contents.
 * ```typescript
 * const a = ["a", "b"];
 * const b = cloneAppend(a, "c");
 *
 * a; // ["a", "b"]
 * b; // ["a", "b", "c"]
 * ```
 * @example
 * An array passed as `item` is stored as a single nested element instead of
 * being flattened the way `concat` would.
 * ```typescript
 * cloneAppend(["a"], ["b", "c"]);
 * // ["a", ["b", "c"]]
 * ```
 */
export const cloneAppend = <T>(array: T[], item: T) => {
	const length = array.length;

	if (length === 0) {
		return [item];
	}

	if (length === 1) {
		return [array[0]!, item];
	}

	const out = new Array<T>(length + 1);

	for (let i = 0; i < length; i++) {
		out[i] = array[i]!;
	}

	out[length] = item;

	return out;
};
