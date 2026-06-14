import type { DeveloperContext } from "@/core/context";
import type { AnyFail, AnyOk } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * @module
 * Middleware step — function shape and chain descriptor for `.middleware()`.
 */

/**
 * Callable shape of a `.middleware()` step. Receives a {@link DeveloperContext}
 * and a `next` continuation that advances the chain. Returning {@link AnyFail}
 * or {@link AnyOk} becomes the response; `void` defers to the rest of the
 * chain. May be sync or async.
 *
 * @example
 * ```typescript
 * const a: MiddlewareFn<MaybePromise<void>, {}, {}> = async (_, next) => {
 *   await next();
 * };
 *
 * const b: MiddlewareFn<MaybePromise<AnyFail | void>, {}, {}> = (
 *   context,
 *   next,
 * ) => {
 *   if (!context.request.raw.headers.get("a")) {
 *     return fail("v1", { status: 401 });
 *   }
 *
 *   return next();
 * };
 * ```
 */
export type MiddlewareFn<
	Return extends MaybePromise<AnyFail | AnyOk | void>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: DeveloperContext<Stores, Validators>,
	next: () => MaybePromise<void>,
) => Return;

/**
 * Any {@link MiddlewareFn} regardless of its return, store, or validator
 * generics. Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyMiddlewareFn[] = [];
 * ```
 */
export type AnyMiddlewareFn = MiddlewareFn<any, any, any>;

/**
 * Compiled {@link MiddlewareFn} descriptor tagged `"MIDDLEWARE"`.
 *
 * @example
 * ```typescript
 * const a: Middleware<MaybePromise<void>, {}, {}> = {
 *   handler: async (_, next) => {
 *     await next();
 *   },
 *   type: "MIDDLEWARE",
 * };
 * ```
 */
export interface Middleware<
	Return extends MaybePromise<AnyFail | AnyOk | void>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	handler: MiddlewareFn<Return, Stores, Validators>;
	type: "MIDDLEWARE";
}

/**
 * Any {@link Middleware} regardless of its return, store, or validator
 * generics. Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyMiddleware[] = [];
 * ```
 */
export type AnyMiddleware = Middleware<any, any, any>;
