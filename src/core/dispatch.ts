import type { AnyContext } from "@/core/context";
import type { Cudenix, Endpoint } from "@/core/cudenix";
import { response } from "@/core/response";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Per-endpoint resolver stored on `endpoint.dispatch`: run the matched endpoint
 * and serialize the result into a `Response`. `compile` assigns one to every
 * endpoint up front — {@link staticDispatch} for a `static`, chainless route, or
 * the specialized dispatcher {@link jit} compiles for everything else — so the
 * request path never has to branch on how a route is served.
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
 * const a = run(endpoint, app, request);
 *
 * a.status; // 200
 * ```
 */
export type Dispatch = (
	app: Cudenix,
	endpoint: Endpoint,
	request: Request,
	match?: RegExpExecArray,
) => MaybePromise<Response>;

/**
 * Serialize a resolved {@link AnyContext} into a `Response`. Cookies are handed
 * to {@link response} only when this request reached us through the regexp
 * fallback or `app.fetch` — a plain `Request` Bun won't post-process. When Bun's
 * native router served the route the request is a `BunRequest` whose `CookieMap`
 * Bun applies itself, so passing it again would emit every `Set-Cookie` twice.
 *
 * The jitted dispatcher {@link jit} builds closes over this and `return`s it as
 * its last statement, so the compiled code serializes inline without a wrapper.
 */
export const serialize = (context: AnyContext) =>
	response(
		context.response.content,
		"cookies" in context.request.raw ? undefined : context.response.cookies,
		context.response.headers,
	);

/**
 * {@link Dispatch} assigned to a `static` route with an empty chain. Its
 * response is request-independent, so `compile` builds it once into
 * `endpoint.response`; this just hands back a fresh clone — no chain run,
 * no re-serialization. (When the path is plain, Bun's router serves that same
 * precomputed `Response` natively; this dispatcher covers the regexp /
 * `app.fetch` path and wildcard static routes Bun can't table.)
 */
export const staticDispatch: Dispatch = (app, endpoint) =>
	endpoint.response!.clone();
