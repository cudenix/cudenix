/**
 * @module
 * Append every element of one array onto another, in place.
 *
 * Use {@link pushAll} when you want to extend a target array with the contents
 * of a source array without paying the cost of spreading the source as
 * variadic arguments to `Array.prototype.push`.
 */

/**
 * Append every element of `source` onto the end of `target`, preserving order.
 *
 * Reach for this when you are growing an existing array with the contents of
 * another array and want the change to land on the original reference. The
 * shape is equivalent to `target.push(...source)`, but the helper sidesteps
 * the variadic spread — which both removes the per-call argument-count limit
 * that engines impose on `push(...arr)` and keeps allocation pressure flat
 * when you call it in a tight loop.
 *
 * Behavior worth knowing before you call it:
 *
 * - **In place** — `target` is mutated. Nothing is returned, so keep a
 *   reference to it if you need to read the appended result later.
 * - **Order preserved** — elements land in `target` in the same order they
 *   appear in `source`, starting at the position right after the existing
 *   tail.
 * - **Shallow copy** — references are copied as-is. Mutating an element
 *   through `target` also mutates it through `source`.
 * - **Aliasing is safe** — passing the same array as both `target` and
 *   `source` duplicates only the elements that existed before the call,
 *   instead of growing forever.
 * - **No argument-count limit** — works on batches large enough that
 *   `target.push(...source)` would throw `RangeError: Maximum call stack
 *   size exceeded`.
 *
 * @typeParam T - Element type shared by both arrays.
 * @param target - Array that receives the appended elements. Mutated in
 *   place.
 * @param source - Array whose elements are copied into `target`.
 * @example
 * Extend an accumulator with a batch of new entries.
 * ```typescript
 * const target = [1, 2];
 *
 * pushAll(target, [3, 4, 5]);
 *
 * target; // [1, 2, 3, 4, 5]
 * ```
 * @example
 * Works safely with very large batches where `target.push(...huge)` would
 * exceed the engine's argument-count limit.
 * ```typescript
 * const target: number[] = [];
 *
 * pushAll(target, new Array(200_000).fill(0));
 *
 * target.length; // 200000
 * ```
 * @example
 * Passing the same array as both `target` and `source` duplicates only the
 * elements that existed before the call.
 * ```typescript
 * const target = [1, 2, 3];
 *
 * pushAll(target, target);
 *
 * target; // [1, 2, 3, 1, 2, 3]
 * ```
 */
export const pushAll = <T>(target: T[], source: T[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
