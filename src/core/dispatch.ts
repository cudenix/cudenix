import type { Endpoint } from "@/core/cudenix";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Per-endpoint resolver stored on `endpoint.dispatch`: run the matched endpoint
 * and serialize the result into a `Response`. `compile` assigns one to every
 * endpoint up front — {@link staticDispatch} for a `static`, chainless route, or
 * the specialized dispatcher {@link jit} compiles for everything else — so the
 * request path never has to branch on how a route is served.
 *
 * The matched endpoint is the dispatcher's `this`: it is always invoked
 * method-style (`endpoint.dispatch(request, match)`) — by `fetch` and by the
 * native-router handler `compile` builds — so it is read off `this` rather than
 * threaded as a redundant argument. The owning `Cudenix` app is likewise not
 * passed per request: it is fixed at `compile` time, so the jitted dispatcher
 * closes over it (and {@link staticDispatch} never needs it at all).
 *
 * The dispatcher receives the raw request materials, not a prebuilt `Context`:
 * {@link staticDispatch} ignores them (its response is request-independent), and
 * the jitted dispatcher builds its own `Context` inline, only for the slots its
 * chain actually reads. The caller (`fetch` / the native-router handler) never
 * allocates a `Context` a static route would discard. `match` is the regexp
 * result on the `fetch` / `app.fetch` path and `undefined` when Bun's native
 * router served the route (params come from the `BunRequest` instead).
 *
 * @example
 * ```typescript
 * const run: Dispatch = staticDispatch;
 *
 * const a = run.call(endpoint, request);
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
 * {@link Dispatch} assigned to a `static` route with an empty chain. Its
 * response is request-independent, so `compile` builds it once into
 * `endpoint.response`; this just hands back a fresh clone — no chain run,
 * no re-serialization. (When the path is plain, Bun's router serves that same
 * precomputed `Response` natively; this dispatcher covers the regexp /
 * `app.fetch` path and wildcard static routes Bun can't table.)
 *
 * Reads the endpoint off `this`, so the single shared function serves every
 * static endpoint without per-endpoint allocation.
 */
export const staticDispatch: Dispatch = function () {
	return this.response!.clone();
};
