import type { DeveloperContext } from "@/core/context";
import type { AnyFail } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * @module
 * Function shape and chain descriptor for `.store()` links.
 */

/**
 * Callable shape of a `.store()` step. Receives a {@link DeveloperContext} and
 * returns either a record merged into `context.store` or an {@link AnyFail}
 * that halts the chain. May be sync or async.
 *
 * @example
 * ```typescript
 * const a: StoreFn<{ a: string }, {}, {}> = () => ({ a: "v1" });
 *
 * const b: StoreFn<{ a: string } | AnyFail, {}, {}> = (context) => {
 *   const v1 = context.request.raw.headers.get("a");
 *
 *   return v1 ? { a: v1 } : fail("v1", { status: 401 });
 * };
 * ```
 */
export type StoreFn<
	Return extends MaybePromise<Record<PropertyKey, unknown> | AnyFail>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (context: DeveloperContext<Stores, Validators>) => Return;

/**
 * Any {@link StoreFn} regardless of its return, store, or validator generics.
 * Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyStoreFn[] = [];
 * ```
 */
export type AnyStoreFn = StoreFn<any, any, any>;

/**
 * Compiled {@link StoreFn} descriptor stored on the chain by `module.store`,
 * tagged `"STORE"`.
 *
 * @example
 * ```typescript
 * const a: Store<{ a: string }, {}, {}> = {
 *   handler: () => ({ a: "v1" }),
 *   type: "STORE",
 * };
 * ```
 */
export interface Store<
	Return extends MaybePromise<Record<PropertyKey, unknown> | AnyFail>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	handler: StoreFn<Return, Stores, Validators>;
	type: "STORE";
}

/**
 * Any {@link Store} regardless of its return, store, or validator generics.
 * Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyStore[] = [];
 * ```
 */
export type AnyStore = Store<any, any, any>;
