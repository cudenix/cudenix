/**
 * Appends a source array segment to a target array.
 *
 * @example
 * ```typescript
 * const target = [1, 2];
 *
 * pushAllFrom(target, [9, 9, 3, 4], 2); // target is now [1, 2, 3, 4]
 * ```
 */
export const pushAllFrom = <T>(target: T[], source: T[], start: number) => {
	const baseLength = target.length;
	const count = source.length - start;

	if (count <= 0) {
		return;
	}

	// presize once, then fill
	target.length = baseLength + count;

	for (let i = 0; i < count; i++) {
		target[baseLength + i] = source[start + i]!;
	}
};
