/**
 * Checks whether two types are mutually assignable.
 *
 * @example
 * ```typescript
 * type A = ExtendsType<string, string>; // true
 * type B = ExtendsType<"v1", string>; // false
 * ```
 */
export type ExtendsType<T, U> = [T, U] extends [U, T] ? true : false;
