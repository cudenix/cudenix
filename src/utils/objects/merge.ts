/**
 * Merges source properties into a target object.
 *
 * @example
 * ```typescript
 * const config = { a: "v1", b: 1 };
 *
 * merge(config, { b: 2, c: true }); // config is now { a: "v1", b: 2, c: true }
 * ```
 */
export const merge = (
	target: Record<string, unknown>,
	source: Record<string, unknown>,
) => {
	// for...in walks the prototype chain and skips symbols, hence the notes above
	for (const key in source) {
		target[key] = source[key];
	}
};
