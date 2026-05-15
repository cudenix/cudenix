/**
 * @module
 * Shallow type-level merge where the second operand wins.
 */

/**
 * Combine `FirstType` and `SecondType` such that any key declared in
 * `SecondType` overrides the corresponding key in `FirstType`.
 *
 * Produced via two intersected halves: the first keeps every key from
 * `FirstType` that is *not* in `SecondType`, and the second is `SecondType`
 * itself. Unlike a plain `FirstType & SecondType`, the override is decided
 * by the *presence* of the key, not by structural compatibility — so a
 * narrower second type cleanly replaces a wider first type instead of
 * intersecting with it.
 *
 * @typeParam FirstType - Base shape.
 * @typeParam SecondType - Overrides applied on top of `FirstType`.
 * @example
 * ```typescript
 * type A = { id: string; tags: string[] };
 * type B = { tags: readonly string[]; total: number };
 *
 * type Merged = Merge<A, B>;
 * // { id: string; tags: readonly string[]; total: number }
 * ```
 */
export type Merge<FirstType extends object, SecondType extends object> = {
	[Key in keyof FirstType as Key extends keyof SecondType
		? never
		: Key]: FirstType[Key];
} & SecondType;
