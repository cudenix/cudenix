/**
 * @module
 * One-directional type-level assignability probe (no union distribution).
 */

/**
 * Resolve to `true` when `T` is assignable to `U`, else `false`. Checks only
 * the `T → U` direction; for mutual assignability use {@link ExtendsType}.
 *
 * @example
 * ```typescript
 * type A = AssignableTo<"v1", string>; // true
 * type B = AssignableTo<string, "v1">; // false
 * ```
 */
export type AssignableTo<T, U> = [T] extends [U] ? true : false;
