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
 * objects and arrays are copied by reference. Last write wins. Iteration is
 * driven by `for...in`, so every enumerable string key reachable on `object2`
 * (including those inherited through its prototype chain) is copied; symbol
 * keys and non-enumerable properties are skipped.
 *
 * Keys land via plain assignment, so a setter inherited by `object1` runs
 * instead of defining an own key. In particular, an own `__proto__` key on
 * `object2` (e.g. out of `JSON.parse`) is not copied onto a plain-object
 * target — it triggers the inherited accessor and swaps the target's
 * prototype instead. Merge untrusted sources into a prototype-free `Empty`
 * target, where `__proto__` lands as a regular own key.
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
