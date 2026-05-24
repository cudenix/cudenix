/**
 * @module
 * Type-level value-or-factory union — express a slot that may receive a
 * concrete value or a zero-argument producer that yields one, synchronously
 * or asynchronously.
 *
 * Use {@link MaybeFunction} on framework seams that should evaluate their
 * input lazily — configuration defaults, registration-time options, or any
 * slot where the cost of producing the value should only be paid when the
 * caller did not supply it directly.
 */

/**
 * Resolve to the union of `T` and a zero-argument factory returning
 * `T | Promise<T>`, so callers can hand in a ready value or defer its
 * computation behind a function call.
 *
 * Reach for this whenever an API contract should accept either a direct
 * value or a producer that builds one on demand — registration-time options
 * whose dependencies are not ready yet, defaults that should not be computed
 * when the caller passes an explicit value, or any seam where the framework
 * is happy to invoke the producer and `await` the result on the caller's
 * behalf. Because the factory branch already covers `T | Promise<T>`, a
 * producer can quietly upgrade to async work later without breaking the
 * signature consumers have already adopted.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Three accepted shapes** — a bare `T`, a sync factory `() => T`, or an
 *   async factory `() => Promise<T>`. A mixed `() => T | Promise<T>` is also
 *   valid, which lets the producer decide per call whether to do the work
 *   eagerly or hand back a promise.
 * - **Factories must be zero-argument** — the framework typically resolves
 *   the slot by invoking the producer with no parameters, so a function that
 *   requires arguments is rejected at compile time instead of failing at
 *   call time.
 * - **The bare-value branch is preserved** — `T extends MaybeFunction<T>`
 *   holds, so callers that supply a concrete value never have to wrap it in
 *   a factory to satisfy the type.
 * - **Resolves uniformly on the consumer side** — pattern matching on
 *   `typeof value === "function"` and awaiting the result keeps both branches
 *   interchangeable, since `await` is a no-op on non-promise values.
 * - **`void` and `undefined` flow through cleanly** — `() => void` satisfies
 *   `MaybeFunction<void>` and `() => undefined` satisfies
 *   `MaybeFunction<undefined>`, so fire-and-forget hooks and nullable
 *   producers both fit the alias.
 * - **Union value types accept any member** — for `MaybeFunction<A | B>`,
 *   both a bare `A` (or `B`) and a factory returning `A` (or `B`) are
 *   accepted, since each member is assignable to the union.
 * - **Value-type mismatches are rejected** — a bare value, sync factory, or
 *   async factory whose value type does not match `T` does not satisfy the
 *   alias, so the type system catches accidental drift between producer and
 *   consumer.
 *
 * @typeParam T - Value type the producer ultimately yields. Any type is
 *   accepted, including primitives, objects, unions, and `void`.
 * @example
 * The alias resolves to a union of the bare value type and a zero-argument
 * factory whose return is itself `T | Promise<T>`.
 * ```typescript
 * type A = MaybeFunction<number>;
 * // number | (() => number | Promise<number>)
 *
 * type B = MaybeFunction<string>;
 * // string | (() => string | Promise<string>)
 * ```
 * @example
 * Each accepted branch — bare value, sync factory, async factory — satisfies
 * the alias on its own.
 * ```typescript
 * type A = number extends MaybeFunction<number> ? true : false;
 * // true
 *
 * type B = (() => number) extends MaybeFunction<number> ? true : false;
 * // true
 *
 * type C = (() => Promise<number>) extends MaybeFunction<number> ? true : false;
 * // true
 * ```
 * @example
 * A factory that hands back either a value or a promise per call still fits
 * the alias, so producers can mix sync and async paths in one function body.
 * ```typescript
 * type A = (() => number | Promise<number>) extends MaybeFunction<number>
 * 	? true
 * 	: false;
 * // true
 * ```
 * @example
 * Union value types accept any member of the union, whether handed in
 * directly or returned by the factory.
 * ```typescript
 * type A = string extends MaybeFunction<number | string> ? true : false;
 * // true
 *
 * type B = (() => number) extends MaybeFunction<number | string> ? true : false;
 * // true
 * ```
 * @example
 * Mismatched value types and argument-taking factories are rejected, so the
 * type system catches producer/consumer drift at compile time.
 * ```typescript
 * type A = string extends MaybeFunction<number> ? true : false;
 * // false
 *
 * type B = ((a: string) => number) extends MaybeFunction<number>
 * 	? true
 * 	: false;
 * // false
 * ```
 */
export type MaybeFunction<T> = T | (() => T | Promise<T>);
