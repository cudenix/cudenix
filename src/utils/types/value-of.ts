/**
 * @module
 * Type-level counterpart to `Object.values` — collapse an object type into
 * the union of its value types.
 */

/**
 * Union of every value type in `T`. The value-side counterpart to `keyof T`.
 *
 * @example
 * ```typescript
 * type A = ValueOf<{ a: "v1"; b: "v2" }>; // "v1" | "v2"
 * type B = ValueOf<{ a?: "v1"; b: "v2" }>; // "v1" | "v2" | undefined
 * ```
 */
export type ValueOf<T extends object> = T[keyof T];
