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
	const sourceLength = source.length;

	// nothing to append must stay a true no-op; writing length would otherwise
	// reject a frozen target and can turn a packed array holey
	if (sourceLength === 0) {
		return;
	}

	const baseLength = target.length;

	// presize once, then fill; a spread push overflows the stack on large sources
	target.length = baseLength + sourceLength;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
