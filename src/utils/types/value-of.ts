/**
 * Resolve to a union of every value type in `T`. The value-side counterpart to
 * `keyof T`.
 *
 * @example
 * ```typescript
 * type A = ValueOf<{ a: "v1"; b: "v2" }>; // "v1" | "v2"
 * type B = ValueOf<{ a?: "v1"; b: "v2" }>; // "v1" | "v2" | undefined
 * ```
 */
export type ValueOf<T extends object> = T[keyof T];
