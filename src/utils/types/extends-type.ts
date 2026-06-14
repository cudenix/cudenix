/**
 * Resolve to `true` when `T` and `U` are mutually assignable, else `false`.
 * Use it when `T extends U` is too permissive — e.g. to tell a literal from
 * its widened primitive.
 *
 * @example
 * ```typescript
 * type A = ExtendsType<string, string>; // true
 * type B = ExtendsType<"v1", string>; // false
 * ```
 */
export type ExtendsType<T, U> = [T, U] extends [U, T] ? true : false;
