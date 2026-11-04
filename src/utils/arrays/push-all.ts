/**
 * Appends all source items to a target array.
 *
 * @example
 * ```typescript
 * const target = [1, 2];
 *
 * pushAll(target, [3, 4, 5]); // target is now [1, 2, 3, 4, 5]
 * ```
 */
export const pushAll = <T>(target: T[], source: readonly T[]): void => {
	// read once, before any push
	const sourceLength = source.length;

	// an oversized result throws before any push
	if (target.length + sourceLength > 4_294_967_295) {
		throw new RangeError("Invalid array length");
	}

	for (let i = 0; i < sourceLength; i++) {
		target.push(source[i]!);
	}
};
