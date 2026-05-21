/**
 * @module
 * Hot-path in-place array concatenation helper.
 */

/**
 * Append every element of `source` to the end of `target`, in order.
 *
 * Leaves `target` with the same appended elements as `target.push(...source)`
 * for ordinary arrays, but this helper intentionally returns `void` instead
 * of the new length. It is designed for hot paths: direct indexed writes avoid
 * building a variadic argument list and calling `push` for each batch. Mutates
 * `target` in place.
 *
 * @typeParam Type - Element type shared by both arrays.
 * @param target - Array that is mutated to receive new elements.
 * @param source - Array whose elements are copied into `target`.
 * @return `void` to avoid encouraging chaining and to reflect that the return
 * @example
 * ```typescript
 * const target = [1, 2];
 *
 * pushAll(target, [3, 4, 5]); // appends without a variadic `push` call
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
