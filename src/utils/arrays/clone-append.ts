/**
 * Return a new array with `item` appended, leaving `array` untouched.
 * Equivalent to `[...array, item]`.
 *
 * @example
 * ```typescript
 * cloneAppend(["a", "b"], "c"); // ["a", "b", "c"]
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
