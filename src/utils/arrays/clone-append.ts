/**
 * @module
 * Hot-path immutable array append helper.
 */

/**
 * Return a new array containing every element of `array` followed by `item`.
 *
 * Equivalent in content to `[...array, item]` for ordinary arrays. Unlike
 * `array.concat(item)`, this always appends `item` as a single element, even
 * when `item` is itself an array or another concat-spreadable value.
 *
 * The implementation is designed for hot paths: empty and single-element
 * inputs use array literals, while longer inputs pre-size the output with
 * `new Array(length + 1)` and fill it through indexed writes. The input is
 * never mutated.
 *
 * @typeParam Type - Element type of the source array and the appended item.
 * @param array - Source array to clone. Left untouched.
 * @param item - Element appended at the end of the returned array.
 * @returns A freshly allocated array of length `array.length + 1`.
 * @example
 * ```typescript
 * cloneAppend([], "a"); // ["a"]
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
