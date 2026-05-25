/**
 * @module
 * Allocate a new array that extends an existing one with a single element.
 */

/**
 * Return a new array containing every element of `array` followed by `item`.
 * Use it when growing an immutable list — pushing onto a middleware chain or
 * any structure whose previous reference must stay unchanged. Equivalent to
 * `[...array, item]`, but skips the iterator protocol and pre-sizes the
 * result.
 *
 * Always appends as one element: an `item` that is itself an array is stored
 * as-is at the tail, not flattened the way `concat` would. Element
 * references are shallow-copied.
 *
 * @typeParam T - Element type shared by the source array and the appended
 *   item.
 * @param array - Source array to clone. Left untouched.
 * @param item - Element appended at the end of the returned array.
 * @returns A freshly allocated array of length `array.length + 1`.
 * @example
 * ```typescript
 * cloneAppend([], "a"); // ["a"]
 * cloneAppend(["a", "b"], "c"); // ["a", "b", "c"]
 *
 * cloneAppend<unknown>(["a"], ["b", "c"]);
 * // ["a", ["b", "c"]] — array appended as one element, not flattened
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
