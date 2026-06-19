import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Callable shape of a `.mount()` target — a WinterCG-style `fetch` handler from
 * another framework (or another Cudenix app). Receives the inbound `Request`
 * with the mount prefix already stripped and returns its own `Response`.
 *
 * @example
 * ```typescript
 * const a: MountFn = (request) => new Response(request.url);
 * ```
 */
export type MountFn = (request: Request) => MaybePromise<Response>;

/**
 * Options accepted by `module.mount` — `prefix` is the path every request is
 * delegated under, defaulting to `/` (the root). Reserved for future
 * delegation options.
 *
 * @example
 * ```typescript
 * const a: MountOptions = { prefix: "/hono" };
 * const b: MountOptions = {};
 * ```
 */
export interface MountOptions {
	prefix?: `/${string}`;
}

/**
 * Compiled `.mount()` descriptor tagged `"MOUNT"` — a foreign `fetch` handler
 * delegated every request under `path`.
 *
 * @example
 * ```typescript
 * const a: Mount = {
 *   fetch: (request) => new Response(request.url),
 *   path: "/hono",
 *   type: "MOUNT",
 * };
 * ```
 */
export interface Mount {
	fetch: MountFn;
	path: `/${string}`;
	type: "MOUNT";
}

/**
 * Any {@link Mount} regardless of its specifics.
 *
 * @example
 * ```typescript
 * const a: AnyMount[] = [];
 * ```
 */
export type AnyMount = Mount;

/**
 * Flattened `.mount()` entry stored on the {@link Cudenix} app — the foreign
 * `fetch` handler paired with its fully-composed prefix `path`.
 *
 * @example
 * ```typescript
 * const a: CompiledMount = {
 *   fetch: (request) => new Response(request.url),
 *   path: "/v1/hono",
 * };
 * ```
 */
export interface CompiledMount {
	fetch: MountFn;
	path: string;
}
