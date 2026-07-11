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
export const pushAll = <T>(target: T[], source: T[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	target.length = baseLength + sourceLength;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
