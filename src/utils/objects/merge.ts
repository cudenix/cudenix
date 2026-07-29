/**
 * Merges source properties into a target object.
 *
 * @example
 * ```typescript
 * const config = { a: "v1", b: 1 };
 *
 * merge(config, { b: 2 }); // config is now { a: "v1", b: 2 }
 *
 * // shallow: the nested object is replaced, not merged
 * const nested = { a: { keep: true, x: 1 } };
 *
 * merge(nested, { a: { x: 2 } }); // nested is now { a: { x: 2 } }
 * ```
 */
export const merge = <
	T extends Record<string, unknown>,
	U extends Record<string, unknown>,
>(
	target: T,
	// a key both objects declare has to keep the target's type; anything else
	// passes through, so the source may still introduce new keys
	source: U & { [K in keyof U]: K extends keyof T ? T[K] : U[K] },
) => {
	// for...in walks the prototype chain and skips symbols
	for (const key in source) {
		(target as Record<string, unknown>)[key] = (
			source as Record<string, unknown>
		)[key];
	}
};
