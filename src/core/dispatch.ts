import type { AnyContext } from "@/core/context";
import type { Endpoint } from "@/core/cudenix";
import { response } from "@/core/response";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Per-endpoint resolver stored on `endpoint.dispatch`: run the matched endpoint
 * and serialize the result into a `Response`. `compile` assigns one to every
 * endpoint up front — {@link staticDispatch} for a `static`, chainless route, or
 * the specialized dispatcher {@link jit} compiles for everything else — so the
 * request path never has to branch on how a route is served.
 *
 * @example
 * ```typescript
 * const run: Dispatch = staticDispatch;
 *
 * const a = run(endpoint, context);
 *
 * a.status; // 200
 * ```
 */
export type Dispatch = (
	endpoint: Endpoint,
	context: AnyContext,
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
export const staticDispatch: Dispatch = (endpoint) =>
	endpoint.response!.clone();
