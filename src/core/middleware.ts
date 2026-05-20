import type { DeveloperContext } from "@/core/context";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import type { MaybePromise } from "@/types/maybe-promise";

/**
 * @module
 * Per-request chain unit that runs developer logic with control over the
 * downstream chain.
 */

/**
 * Function signature of a middleware unit registered through
 * `Module.middleware`.
 *
 * A middleware runs once per request, inside the same chain that walks
 * stores and validators, and receives a `next` callback that resumes the
 * chain from the next link onward. Calling `next()` is what lets downstream
 * units run; skipping the call short-circuits the chain at this position.
 * Because `next` returns a {@link MaybePromise}, callers must `await` it
 * when downstream work is asynchronous.
 *
 * Returning an {@link AnyError} or {@link AnySuccess} writes the value into
 * `context.response.content` after the middleware resolves. When `next` was
 * called first, this overrides whatever the downstream chain produced; when
 * `next` was skipped, the returned value becomes the response on its own.
 * Returning `undefined` — the common case for pass-through middlewares —
 * leaves the response untouched. The function may be synchronous or return
 * a `Promise`; both shapes are accepted so callers can avoid an async tick
 * when no async work is needed.
 *
 * @typeParam Return - Value produced by the middleware. {@link AnyError} or
 *   {@link AnySuccess} becomes the response; `undefined` lets the chain
 *   continue without overriding it.
 * @typeParam Stores - Shape of `context.store` visible to this unit, built
 *   from every prior store in the chain.
 * @typeParam Validators - Validated request fields visible to this unit,
 *   built from every prior validator in the chain.
 */
export type MiddlewareFn<
	Return extends MaybePromise<AnyError | AnySuccess | undefined>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = (
	context: DeveloperContext<Stores, Validators>,
	next: () => MaybePromise<void>,
) => Return;

/**
 * Convenience alias matching any {@link MiddlewareFn} regardless of return,
 * stores, or validators parameters.
 *
 * Reach for it where the concrete generics are erased — for example, the
 * parameter type of `Module.prototype.middleware`, which receives whichever
 * middleware the caller registered without seeing its captured shape.
 */
export type AnyMiddlewareFn = MiddlewareFn<any, any, any>;

/**
 * Internal descriptor for a middleware unit, pushed onto a module's chain by
 * `Module.middleware` and consumed by the runtime on every request.
 *
 * `middleware` holds the user-supplied function; `type` is the discriminant
 * the runtime uses to tell middleware units apart from stores, validators,
 * and routes while walking the chain in declaration order.
 *
 * @typeParam Return - Value produced by the middleware. {@link AnyError} or
 *   {@link AnySuccess} becomes the response; `undefined` lets the chain
 *   continue without overriding it.
 * @typeParam Stores - Shape of `context.store` visible to this unit.
 * @typeParam Validators - Validated request fields visible to this unit.
 */
export interface Middleware<
	Return extends MaybePromise<AnyError | AnySuccess | undefined>,
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	middleware: MiddlewareFn<Return, Stores, Validators>;
	type: "MIDDLEWARE";
}

/**
 * Convenience alias matching any {@link Middleware} regardless of return,
 * stores, or validators parameters.
 *
 * Reach for it in container or registry types where the concrete generics
 * are irrelevant — for example, the heterogeneous `Chain` array that holds
 * every unit attached to an endpoint.
 */
export type AnyMiddleware = Middleware<any, any, any>;
