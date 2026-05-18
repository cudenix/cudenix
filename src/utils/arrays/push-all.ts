/**
 * @module
 * Hot-path in-place array concatenation helper.
 */

/**
 * Append every element of `source` to the end of `target`, in order.
 *
 * Equivalent in effect to `target.push(...source)` for ordinary arrays and,
 * in most hot-path cases, faster: the spread form has to materialize the
 * source as a variadic argument list and invoke `push` as a variadic call.
 * A straight indexed write loop can stay on the engine's dense-array store
 * path and skips the per-call overhead of `push`. Mutates `target` in place.
 *
 * @typeParam Type - Element type shared by both arrays.
 * @param target - Array that is mutated to receive new elements.
 * @param source - Array whose elements are copied into `target`.
 * @example
 * ```typescript
 * const target = [1, 2];
 *
 * pushAll(target, [3, 4, 5]); // faster than `push(...items)` in most hot paths
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
