/**
 * @module
 * Append every element of one array onto another, in place.
 */

/**
 * Append every element of `source` onto the end of `target`, preserving
 * order. Equivalent to `target.push(...source)` but sidesteps the variadic
 * spread — no per-call argument-count limit, and flat allocation pressure in
 * tight loops.
 *
 * In place — `target` is mutated and nothing is returned. References are
 * shallow-copied. Passing the same array as both `target` and `source`
 * duplicates only the elements that existed before the call.
 *
 * @typeParam T - Element type shared by both arrays.
 * @param target - Array that receives the appended elements. Mutated in
 *   place.
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
export const pushAll = <T>(target: T[], source: T[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
