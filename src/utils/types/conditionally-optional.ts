/**
 * Filter properties before taking keyof so index signatures cannot hide them.
 */
type UnchangedProperties<T extends object, U> = {
	[K in keyof T as [U extends T[K] ? K : never] extends [never]
		? K
		: never]: T[K];
};

/**
 * Filter properties of a type that are optional based on a given marker.
 */
type OptionalProperties<T extends object, U> = {
	[K in keyof T as U extends T[K] ? K : never]?: T[K];
};

/**
 * Marks as optional every property whose type accepts a given marker.
 *
 * @example
 * ```typescript
 * type A = ConditionallyOptional<
 *   { a: string; b: string | undefined },
 *   undefined
 * >;
 * // { a: string; b?: string | undefined }
 *
 * type B = ConditionallyOptional<{ a: string } | { b: number }, string>;
 * // { a?: string } | { b: number }
 * ```
 */
export type ConditionallyOptional<T extends object, U> = T extends unknown
	? T extends readonly unknown[]
		? T
		: keyof OptionalProperties<T, U> extends never
			? T
			: keyof UnchangedProperties<T, U> extends never
				? Partial<T>
				: UnchangedProperties<T, U> & OptionalProperties<T, U>
	: never;
