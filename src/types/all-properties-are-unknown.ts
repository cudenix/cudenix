/**
 * @module
 * Type-level predicate that reports whether every property in an object type
 * carries the value type `unknown`.
 *
 * Use {@link AllPropertiesAreUnknown} as a sentinel for detecting fully
 * unrefined generics — for example, picking a default branch when a validator
 * schema was never supplied, or short-circuiting a conditional type when the
 * caller has not narrowed any of the slots in an options bag.
 */

/**
 * Resolve to `true` when every property of `T` is typed as `unknown`,
 * otherwise `false`.
 *
 * Reach for this whenever you need to tell apart an "untouched" shape — one
 * the caller has not bothered to refine — from one that carries at least one
 * concrete value type. The predicate mirrors how a framework typically decides
 * whether to skip validation, fall back to a default schema, or pick an empty
 * branch in a conditional type: if nothing was narrowed, treat the input as
 * vacuous; otherwise, propagate the refined shape downstream. Because the
 * result is a literal `true` or `false`, it composes cleanly with any
 * conditional type that needs to gate on "did the caller supply anything
 * meaningful?".
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Homogeneous-`unknown` shapes resolve to `true`** — any object whose
 *   declared keys are all typed as `unknown` (required or optional, readonly
 *   or not) is reported as unrefined.
 * - **Empty objects resolve to `true`** — shapes with no own properties, such
 *   as `NonNullable<unknown>` or an instance of a class with no fields, are
 *   treated as vacuously unrefined instead of falling through to `false`.
 * - **`any` is treated the same as `unknown`** — because `unknown` is
 *   assignable to `any`, a key typed as `any` counts as unrefined. An object
 *   whose properties are a mix of `any` and `unknown` still resolves to
 *   `true`.
 * - **Index signatures pass through** — `Record<string, unknown>`,
 *   `Record<number, unknown>`, and `Record<symbol, unknown>` all resolve to
 *   `true`; an index signature with a concrete value type resolves to
 *   `false`.
 * - **A single concrete key flips the result** — as soon as any property is
 *   typed as something other than `unknown` or `any`, the predicate resolves
 *   to `false`. This includes narrow unions, `null`, `undefined`,
 *   `string | undefined`, and `never`.
 * - **`readonly` does not change the answer** — the modifier affects
 *   mutability, not the value type, so readonly keys are evaluated the same
 *   as their mutable counterparts.
 * - **Tuples and arrays resolve to `false`** — even when every element is
 *   typed as `unknown`, the synthetic members declared on array-like types
 *   (such as `length` or numeric index signatures with concrete types) keep
 *   the predicate from ever returning `true`.
 *
 * @typeParam T - Object-shaped type whose property value types are inspected.
 *   Must extend `object`.
 * @example
 * A shape whose properties are all `unknown` resolves to `true`, regardless
 * of how many keys there are or whether some are optional or readonly.
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: unknown; b: unknown }>;
 * // true
 *
 * type B = AllPropertiesAreUnknown<{ a: unknown; b?: unknown; c: unknown }>;
 * // true
 *
 * type C = AllPropertiesAreUnknown<{ readonly a: unknown; b: unknown }>;
 * // true
 * ```
 * @example
 * Empty objects and class instances with no own fields are treated as
 * vacuously unrefined and resolve to `true`.
 * ```typescript
 * type A = AllPropertiesAreUnknown<NonNullable<unknown>>;
 * // true
 *
 * class B {}
 * type C = AllPropertiesAreUnknown<B>;
 * // true
 * ```
 * @example
 * Index signatures with an `unknown` value type resolve to `true`, while
 * those with a concrete value type resolve to `false`.
 * ```typescript
 * type A = AllPropertiesAreUnknown<Record<string, unknown>>;
 * // true
 *
 * type B = AllPropertiesAreUnknown<Record<number, unknown>>;
 * // true
 *
 * type C = AllPropertiesAreUnknown<Record<string, string>>;
 * // false
 * ```
 * @example
 * Properties typed as `any` count as unrefined and resolve to `true`, but a
 * single concrete sibling flips the result to `false`.
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: any; b: unknown }>;
 * // true
 *
 * type B = AllPropertiesAreUnknown<{ a: any; b: string }>;
 * // false
 * ```
 * @example
 * Any concrete value type — including a narrow union, `null`, `undefined`,
 * or `never` — flips the predicate to `false`, even when other properties
 * remain `unknown`.
 * ```typescript
 * type A = AllPropertiesAreUnknown<{ a: unknown; b: string }>;
 * // false
 *
 * type B = AllPropertiesAreUnknown<{ a: "v1" | "v2" }>;
 * // false
 *
 * type C = AllPropertiesAreUnknown<{ a: string | undefined }>;
 * // false
 *
 * type D = AllPropertiesAreUnknown<{ a: unknown; b: never; c: unknown }>;
 * // false
 * ```
 * @example
 * Tuples and arrays resolve to `false` even when every element is `unknown`,
 * because their synthetic members carry concrete value types.
 * ```typescript
 * type A = AllPropertiesAreUnknown<[unknown, unknown]>;
 * // false
 *
 * type B = AllPropertiesAreUnknown<unknown[]>;
 * // false
 * ```
 */
export type AllPropertiesAreUnknown<T extends object> = {
	[K in keyof T]: unknown extends T[K] ? true : false;
}[keyof T] extends true | undefined
	? true
	: false;
