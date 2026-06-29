/**
 * Merge `source` into `target` in place, overwriting existing keys.
 *
 * @example
 * ```typescript
 * const config = { a: "v1", b: 1 };
 *
 * merge(config, { b: 2, c: true }); // config is now { a: "v1", b: 2, c: true }
 * ```
 */
export const merge = (
	target: Record<PropertyKey, unknown>,
	source: Record<PropertyKey, unknown>,
) => {
	for (const key in source) {
		target[key] = source[key];
	}
};
