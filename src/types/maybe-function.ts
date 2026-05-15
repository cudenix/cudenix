/**
 * @module
 * Value-or-factory helper.
 */

/**
 * Accept either a concrete `Type` or a zero-argument factory that produces
 * one — synchronously or asynchronously.
 *
 * Useful for slots that should be evaluated lazily — for example,
 * configuration values whose dependencies are only resolved at registration
 * time, or defaults that should not be computed when a caller supplies an
 * explicit value.
 *
 * @typeParam Type - Value type the producer ultimately yields.
 * @example
 * ```typescript
 * const fromValue: MaybeFunction<number> = 42;
 * const fromSync:  MaybeFunction<number> = () => 42;
 * const fromAsync: MaybeFunction<number> = async () => 42;
 * ```
 */
export type MaybeFunction<Type> = Type | (() => Type | Promise<Type>);
