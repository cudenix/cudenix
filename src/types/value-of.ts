/**
 * @module
 * Type-level counterpart to `Object.values` — collapse an object type into
 * the union of its value types.
 */

/**
 * Union of every value type declared in `T`. Mirrors `keyof T` for the value
 * side. Required, optional, and `readonly` keys all contribute; literal types
 * are preserved; duplicate values deduplicate.
 *
 * @typeParam T - Object-shaped type whose value side is collapsed.
 * @example
 * ```typescript
 * type A = ValueOf<{ a: "v1"; b: "v2" }>; // "v1" | "v2"
 * type B = ValueOf<{ a: string; b: number }>; // string | number
 * type C = ValueOf<Record<string, "v1" | "v2">>; // "v1" | "v2"
 * ```
 */
export type ValueOf<T extends object> = T[keyof T];
