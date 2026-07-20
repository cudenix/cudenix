import type { Endpoint } from "@/core/cudenix";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Endpoint request dispatcher.
 *
 * @example
 * ```typescript
 * const run: Dispatch = staticDispatch;
 *
 * const a = await run.call(endpoint, request);
 *
 * a.status; // 200
 * ```
 */
export type Dispatch = (
	this: Endpoint,
	request: Request,
	match?: RegExpExecArray,
) => MaybePromise<Response>;

/**
 * Dispatcher for a static route with an empty chain.
 *
 * @example
 * ```typescript
 * const a = await staticDispatch.call(endpoint, request);
 *
 * a.status; // 200
 * ```
 */
export const staticDispatch: Dispatch = function () {
	return this.response!.clone();
};
