/**
 * Append every element of `source` onto the end of `target`, in place.
 * Equivalent to `target.push(...source)`; nothing is returned.
 *
 * @example
 * ```typescript
 * const target = [1, 2];
 *
 * pushAll(target, [3, 4, 5]); // target is now [1, 2, 3, 4, 5]
 * ```
 */
export const pushAll = <T>(target: T[], source: T[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
