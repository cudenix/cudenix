/**
 * @module
 * Shallow object merge utility.
 *
 * Use {@link merge} to copy keys from one object into another in place,
 * letting you overlay overrides onto a base dictionary without allocating
 * a new container.
 */

/**
 * Copy every enumerable string key from `object2` into `object1`,
 * overwriting any matching keys that already exist on the target.
 *
 * Reach for this when you need to apply overrides on top of a base object
 * (for example, merging user options into a defaults dictionary) and want
 * the change to land on the original reference rather than on a copy.
 *
 * Behavior worth knowing before you call it:
 *
 * - **In place** — `object1` is mutated. Nothing is returned, so keep a
 *   reference to the target if you need to read the result later.
 * - **Shallow** — nested objects and arrays are copied by reference, not
 *   cloned. Mutating a nested value through one object also affects the
 *   other.
 * - **Last write wins** — keys present in both objects take the value
 *   from `object2`; there is no conflict resolution.
 * - **String keys only** — symbol keys and non-enumerable properties are
 *   skipped.
 *
 * @param object1 - Target object that receives the keys. Mutated in place.
 * @param object2 - Source object whose entries are copied into `object1`.
 * @example
 * Apply user options on top of a defaults dictionary.
 * ```typescript
 * const config = { a: "v1", b: 1 };
 *
 * merge(config, { b: 2, c: true });
 *
 * config; // { a: "v1", b: 2, c: true }
 * ```
 * @example
 * The original reference is mutated, so any alias of `object1` also sees
 * the merged result.
 * ```typescript
 * const target = { a: 1 };
 * const alias = target;
 *
 * merge(target, { b: 2 });
 *
 * alias; // { a: 1, b: 2 }
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
