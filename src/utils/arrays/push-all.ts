/**
 * @module
 * In-place array extension helper.
 */

/**
 * Append every element of `source` to the end of `target`, in order.
 *
 * Equivalent in effect to `target.push(...source)` but the indexed write
 * loop avoids the variadic spread allocation and remains safe for arbitrarily
 * large `source` arrays where the spread form would risk a call-stack
 * overflow. Mutates `target` in place.
 *
 * @typeParam Type - Element type shared by both arrays.
 * @param target - Array that is mutated to receive new elements.
 * @param source - Array whose elements are copied into `target`.
 * @example
 * ```typescript
 * const target = [1, 2];
 *
 * pushAll(target, [3, 4, 5]);
 *
 * target; // [1, 2, 3, 4, 5]
 * ```
 */
export const pushAll = <Type>(target: Type[], source: Type[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
