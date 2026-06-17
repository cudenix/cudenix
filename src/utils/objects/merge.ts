/**
 * Merge `object2` into `object1` in place, overwriting existing keys.
 *
 * @example
 * ```typescript
 * const config = { a: "v1", b: 1 };
 *
 * merge(config, { b: 2, c: true }); // config is now { a: "v1", b: 2, c: true }
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
