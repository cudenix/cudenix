import type { DeveloperContext } from "@/core/context";
import type { AnyFail, AnyOk } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * @module
 * Middleware step — function shape and chain descriptor for `.middleware()`
 * links that wrap the rest of the chain through a `next` continuation.
 */

/**
 * Callable shape of a `.middleware()` step. Receives a {@link DeveloperContext}
 * carrying the stores and validator outputs visible at this point in the
 * chain, plus a `next` continuation that advances the chain when invoked.
 *
 * Return one of three shapes: a {@link AnyFail} or {@link AnyOk}
 * becomes the response — overriding whatever downstream produced — while
 * `void` defers the outcome to the rest of the chain. Skip
 * the `next` call to halt the chain and keep control entirely. Sync and async
 * functions are both accepted; async returns are awaited before the
 * surrounding step continues.
 *
 * @typeParam Return - Error, success, or void produced by the middleware.
 * @typeParam Stores - Shape of `context.store` visible to this step.
 * @typeParam Validators - Shape of the validated request fields on `context.request`.
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
 * Wildcard alias matching any {@link MiddlewareFn} regardless of
 * return, store, or validator generics. Use in container, registry, or
 * boundary types where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyMiddlewareFn[] = [];
 * ```
 */
export type AnyMiddlewareFn = MiddlewareFn<any, any, any>;

/**
 * Compiled middleware descriptor pushed onto the chain by
 * `module.middleware`. Pairs the user-supplied {@link MiddlewareFn} with a
 * `"MIDDLEWARE"` discriminator so the chain walker can dispatch on link kind.
 *
 * Built by the framework — application code rarely constructs one directly.
 *
 * @typeParam Return - Error, success, or void produced by the middleware.
 * @typeParam Stores - Shape of `context.store` visible to the inner function.
 * @typeParam Validators - Shape of the validated request fields on `context.request`.
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
 * Wildcard alias matching any {@link Middleware} regardless of return,
 * store, or validator generics. Use in container, registry, or boundary
 * types where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyMiddleware[] = [];
 * ```
 */
export type AnyMiddleware = Middleware<any, any, any>;
