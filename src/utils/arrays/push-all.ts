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
export const pushAll = <T>(target: T[], source: readonly T[]) => {
	const sourceLength = source.length;

	// nothing to append
	if (sourceLength === 0) {
		return;
	}

	const baseLength = target.length;

	// presize once, then fill
	target.length = baseLength + sourceLength;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
