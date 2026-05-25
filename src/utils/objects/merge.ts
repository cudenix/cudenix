/**
 * @module
 * Shallow in-place object merge.
 */

/**
 * Copy every enumerable string key from `object2` into `object1`, overwriting
 * matching keys. Use it to apply overrides on top of a base object without
 * allocating a new container.
 *
 * In place — `object1` is mutated and nothing is returned. Shallow — nested
 * objects and arrays are copied by reference. Last write wins. Symbol keys
 * and non-enumerable properties are skipped.
 *
 * @param object1 - Target object that receives the keys. Mutated in place.
 * @param object2 - Source object whose entries are copied into `object1`.
 * @example
 * ```typescript
 * const config = { a: "v1", b: 1 };
 *
 * merge(config, { b: 2, c: true });
 *
 * config; // { a: "v1", b: 2, c: true }
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
