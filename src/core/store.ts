import type { Context } from "@/core/context";
import type { AnyFail } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Defines a `.store()` handler.
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
> = (context: Context<Stores, Validators>) => Return;

/**
 * Any {@link StoreFn} regardless of its return, store, or validator generics.
 *
 * @example
 * ```typescript
 * const a: AnyStoreFn[] = [];
 * ```
 */
export type AnyStoreFn = StoreFn<any, any, any>;

/**
 * Compiled {@link StoreFn} descriptor tagged `"STORE"`.
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
 *
 * @example
 * ```typescript
 * const a: AnyStore[] = [];
 * ```
 */
export type AnyStore = Store<any, any, any>;
