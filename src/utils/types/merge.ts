/**
 * @module
 * Type-level shallow merge — overlay an overrides type onto a base type,
 * with the second operand winning on every overlapping key.
 */

/**
 * Carry every key from `T`, replacing any key also declared in `U` wholesale
 * by `U`'s declaration. Unlike `T & U`, replacement is decided by key
 * presence alone, so a narrower or unrelated value type in `U` cleanly
 * replaces the original instead of being intersected with it.
 *
 * Shallow: overlapping nested object keys are replaced wholesale, not merged
 * recursively. Optionality and `readonly` follow the winning side per key.
 *
 * @typeParam T - Base shape whose keys are inherited unless overridden.
 * @typeParam U - Overrides shape applied on top of `T`.
 * @example
 * ```typescript
 * type A = Merge<{ a: string; b: number }, { b: boolean; c: string }>;
 * // { a: string; b: boolean; c: string }
 *
 * type B = Merge<{ a: string[] }, { a: readonly string[] }>;
 * // { a: readonly string[] }
 * ```
 */
export type Merge<T extends object, U extends object> = {
	[K in keyof T as K extends keyof U ? never : K]: T[K];
} & U;
