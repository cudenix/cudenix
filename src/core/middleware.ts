import type { Context } from "@/core/context";
import type { AnyFail, AnyOk } from "@/core/reply";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Middleware handler that may continue or return a response.
 *
 * @example
 * ```typescript
 * const a: MiddlewareFn<MaybePromise<void>, {}, {}> = (_, next) => next();
 * ```
 */
export type MiddlewareFn<
	Return extends MaybePromise<AnyFail | AnyOk | void>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: Context<Stores, Validators>,
	next: () => MaybePromise<void>,
) => Return;

/**
 * Any {@link MiddlewareFn} regardless of its generics.
 *
 * @example
 * ```typescript
 * const a: AnyMiddlewareFn[] = [];
 * ```
 */
export type AnyMiddlewareFn = MiddlewareFn<any, any, any>;

/**
 * Compiled {@link MiddlewareFn} descriptor tagged `"MIDDLEWARE"`.
 */
interface Middleware<
	Return extends MaybePromise<AnyFail | AnyOk | void>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	handler: MiddlewareFn<Return, Stores, Validators>;
	type: "MIDDLEWARE";
}

/**
 * Any {@link Middleware} regardless of its generics.
 *
 * @example
 * ```typescript
 * const a: AnyMiddleware[] = [];
 * ```
 */
export type AnyMiddleware = Middleware<any, any, any>;
