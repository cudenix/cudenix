import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Defines a WinterCG-style `fetch` handler for `.mount()`.
 *
 * @example
 * ```typescript
 * const a: MountFn = (request) => new Response(request.url);
 * ```
 */
export type MountFn = (request: Request) => MaybePromise<Response>;

/**
 * Options for `module.mount`.
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
 * Compiled `.mount()` descriptor.
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
 * Flattened `.mount()` entry stored on the app.
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
