/**
 * Collects the property value types of an object.
 *
 * @example
 * ```typescript
 * type A = ValueOf<{ a: "v1"; b: "v2" }>; // "v1" | "v2"
 * type B = ValueOf<{ a?: "v1"; b: "v2" }>; // "v1" | "v2" | undefined
 * type C = ValueOf<{ a: "v1" } | { b: "v2" }>; // "v1" | "v2"
 * ```
 */
export type ValueOf<T extends object> = T extends unknown ? T[keyof T] : never;
