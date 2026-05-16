/**
 * @module
 * Fast immutable array append tuned for hot paths.
 */

/**
 * Return a new array containing every element of `array` followed by `item`.
 *
 * Equivalent in effect to `[...array, item]` or `array.concat([item])` but
 * consistently faster: the spread form materialises a variadic argument list
 * and `concat` goes through a generic boxed path, while this helper
 * pre-sizes the output with `new Array(length + 1)` and fills it with an
 * indexed write loop that stays on the engine's monomorphic dense-array
 * store path. Empty and single-element inputs short-circuit through array
 * literals so the common cases skip the `new Array` allocation entirely.
 * The input is never mutated.
 *
 * @typeParam Type - Element type of the source array and the appended item.
 * @param array - Source array to clone. Left untouched.
 * @param item - Element appended at the end of the returned array.
 * @returns A freshly allocated array of length `array.length + 1`.
 * @example
 * ```typescript
 * cloneAppend([], "a"); // ["a"] — faster than `[...[], "a"]`
 * cloneAppend(["a"], "b"); // ["a", "b"]
 * cloneAppend(["a", "b"], "c"); // ["a", "b", "c"]
 * ```
 */
export const cloneAppend = <Type>(array: Type[], item: Type) => {
	const length = array.length;

	if (length === 0) {
		return [item];
	}

	if (length === 1) {
		return [array[0]!, item];
	}

	const out = new Array<Type>(length + 1);

	for (let i = 0; i < length; i++) {
		out[i] = array[i]!;
	}

	out[length] = item;

	return out;
};
