import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";
import type { MaybePromise } from "@/types/maybe-promise";

/**
 * @module
 * Store step — function shape and chain descriptor for `.store()` links that
 * compute values and merge them into the request-scoped store.
 */

/**
 * Callable shape of a `.store()` step. Receives a {@link DeveloperContext}
 * carrying the stores accumulated by earlier links and the parsed validator
 * outputs, and returns either a record merged into `context.store` or an
 * {@link AnyError} that halts the chain and becomes the response.
 *
 * Sync and async functions are both accepted; async returns are awaited
 * before the next link runs.
 *
 * @typeParam Return - Object merged into `context.store`, or an error halting the chain.
 * @typeParam Stores - Shape of `context.store` visible to this step.
 * @typeParam Validators - Shape of the validated request fields on `context.request`.
 * @example
 * ```typescript
 * const a: StoreFn<{ a: string }, {}, {}> = () => ({ a: "v1" });
 *
 * const b: StoreFn<{ a: string } | AnyError, {}, {}> = (context) => {
 *   const v1 = context.request.raw.headers.get("a");
 *
 *   return v1 ? { a: v1 } : new Error("v1", { status: 401 });
 * };
 * ```
 */
export type StoreFn<
	Return extends Record<PropertyKey, unknown> | AnyError,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (context: DeveloperContext<Stores, Validators>) => MaybePromise<Return>;

/**
 * Wildcard alias matching any {@link StoreFn} regardless of return,
 * store, or validator generics. Use in container, registry, or boundary
 * types where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyStoreFn[] = [];
 * ```
 */
export type AnyStoreFn = StoreFn<any, any, any>;

/**
 * Compiled store descriptor pushed onto the chain by `module.store`. Pairs
 * the user-supplied {@link StoreFn} with a `"STORE"` discriminator so the
 * chain walker can dispatch on link kind.
 *
 * Built by the framework — application code rarely constructs one directly.
 *
 * @typeParam Return - Object merged into `context.store`, or an error halting the chain.
 * @typeParam Stores - Shape of `context.store` visible to the inner function.
 * @typeParam Validators - Shape of the validated request fields on `context.request`.
 * @example
 * ```typescript
 * const a: Store<{ a: string }, {}, {}> = {
 *   store: () => ({ a: "v1" }),
 *   type: "STORE",
 * };
 * ```
 */
export interface Store<
	Return extends Record<PropertyKey, unknown> | AnyError,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	store: StoreFn<Return, Stores, Validators>;
	type: "STORE";
}

/**
 * Wildcard alias matching any {@link Store} regardless of return,
 * store, or validator generics. Use in container, registry, or boundary
 * types where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyStore[] = [];
 * ```
 */
export type AnyStore = Store<any, any, any>;
