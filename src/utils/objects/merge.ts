/**
 * @module
 * In-place object merge helper.
 */

/**
 * Copy every enumerable own and inherited key from `object2` to `object1`.
 *
 * The merge happens in place — `object1` is mutated and no new container is
 * allocated. Values in `object2` overwrite matching keys in `object1`, and
 * the iteration relies on `for..in` so prototype chains are walked.
 *
 * @param object1 - Target dictionary that receives the keys.
 * @param object2 - Source dictionary whose entries are copied into `object1`.
 * @example
 * ```typescript
 * const base = { a: 1, b: 2 };
 *
 * merge(base, { b: 20, c: 30 });
 *
 * base; // { a: 1, b: 20, c: 30 }
 * ```
 */
export const merge = (
	object1: Record<PropertyKey, unknown>,
	object2: Record<PropertyKey, unknown>,
) => {
	for (const key in object2) {
		object1[key] = object2[key];
	}
};
