import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";

/**
 * @module
 * Per-request chain unit that contributes keys to `context.store`.
 */

/**
 * Function signature of a store unit registered through `Module.store`.
 *
 * A store runs once per request, inside the same chain that walks
 * middlewares and validators, and produces a dictionary that the runtime
 * merges into the request-scoped `context.store` before the next link is
 * invoked. Returning an {@link AnyError} short-circuits the chain — the
 * error becomes the response and no further units run.
 *
 * The function may be synchronous or return a `Promise`; both shapes are
 * accepted so callers can avoid an async tick when the data they need is
 * already available.
 *
 * @typeParam Return - Dictionary contributed to `context.store`, or an
 *   {@link AnyError} that aborts the chain. The non-error half of `Return`
 *   is intersected into the downstream `Stores` shape so later units see
 *   the new keys with their concrete types.
 * @typeParam Stores - Shape of `context.store` visible to this unit, built
 *   from every prior store in the chain.
 * @typeParam Validators - Validated request fields visible to this unit,
 *   built from every prior validator in the chain.
 * @example
 * ```typescript
 * const loadUser: StoreFn<
 *   { user: User } | Error<"unauthorized", 401>,
 *   {},
 *   { headers: { authorization: string } }
 * > = async (context) => {
 *   const user = await users.find(context.request.headers.authorization);
 *
 *   if (!user) return new Error("unauthorized", { status: 401 });
 *
 *   return { user };
 * };
 * ```
 */
export type StoreFn<
	Return extends Record<PropertyKey, unknown> | AnyError,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (context: DeveloperContext<Stores, Validators>) => Return | Promise<Return>;

/**
 * Convenience alias matching any {@link StoreFn} regardless of return,
 * stores, or validators parameters.
 *
 * Reach for it where the concrete generics are erased — for example, the
 * parameter type of `Module.prototype.store`, which receives whichever
 * store the caller registered without seeing the keys it produces.
 */
export type AnyStoreFn = StoreFn<any, any, any>;

/**
 * Internal descriptor for a store unit, pushed onto a module's chain by
 * `Module.store` and consumed by the runtime on every request.
 *
 * `store` holds the user-supplied function; `type` is the discriminant
 * the runtime uses to tell store units apart from middlewares, validators,
 * and routes while walking the chain in declaration order.
 *
 * @typeParam Return - Dictionary contributed to `context.store`, or an
 *   {@link AnyError} that aborts the chain.
 * @typeParam Stores - Shape of `context.store` visible to this unit.
 * @typeParam Validators - Validated request fields visible to this unit.
 * @example
 * ```typescript
 * const link: Store<{ user: User }, {}, {}> = {
 * 	store: (context) => ({ user: loadUser(context) }),
 * 	type: "STORE",
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
 * Convenience alias matching any {@link Store} regardless of return,
 * stores, or validators parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, the heterogeneous `Chain` array that holds
 * every unit attached to an endpoint.
 */
export type AnyStore = Store<any, any, any>;
