/**
 * Checks whether one type is assignable to another.
 *
 * @example
 * ```typescript
 * type A = AssignableTo<"v1", string>; // true
 * type B = AssignableTo<string, "v1">; // false
 * ```
 */
export type AssignableTo<T, U> = [T] extends [U] ? true : false;
