/**
 * @module
 * Relax keys of an object whose value type already admits a given marker —
 * turning explicit `| undefined` (or another sentinel) fields into truly
 * optional ones.
 */

/**
 * Copy of `T` where every key whose value type accepts `U` is re-declared
 * with `?`. Use it to lift an explicit `| undefined` (or any sentinel) into
 * the optional-key vocabulary so callers can omit the field entirely.
 *
 * The check is "marker fits into value": a field typed as `string` is relaxed
 * by `"v1"`, but a field typed as `"v1"` is not relaxed by `string`.
 * `readonly` is preserved per promoted key. Unmatched keys pass through
 * untouched.
 *
 * @typeParam T - Source object whose keys are inspected.
 * @typeParam U - Marker value; keys whose value type accepts it become
 *   optional.
 * @example
 * ```typescript
 * type A = ConditionallyOptional<
 *   { a: string; b: string | undefined },
 *   undefined
 * >;
 * // { a: string; b?: string | undefined }
 *
 * type B = ConditionallyOptional<{ a: string | null; b: number }, null>;
 * // { a?: string | null; b: number }
 * ```
 */
export type ConditionallyOptional<T extends object, U> = {
	[K in keyof T]-?: U extends T[K] ? K : never;
}[keyof T] extends infer UK extends keyof T
	? Omit<T, UK> & {
			[K in UK]?: T[K];
		}
	: never;
