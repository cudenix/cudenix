import type { Cudenix } from "@/core/cudenix";
import type { AnyFail, AnyOk } from "@/core/reply";

/**
 * Response state materialized only when an endpoint uses it.
 *
 * @example
 * ```typescript
 * const response: ContextResponse = {
 *   content: ok({ a: "v1" }),
 *   cookies: new Bun.CookieMap(),
 *   headers: new Headers(),
 * };
 * ```
 */
export interface ContextResponse {
	/** Content staged by handlers. */
	content?: AnyFail | AnyOk | ReadableStream;
	/** Incoming cookies and staged mutations. */
	cookies: Bun.CookieMap;
	/** Headers staged for the response. */
	headers: Headers;
}

/**
 * Per-request state exposed to route, middleware, and store handlers.
 *
 * @example
 * ```typescript
 * const handler = (context: Context<{ a: string }, {}>) => {
 *   context.store.a; // string
 *   context.response.content = ok({ a: "v1" });
 * };
 * ```
 */
export interface Context<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	/** Application memory shared across requests. */
	memory: Cudenix["memory"];
	/** Raw request combined with validated input. */
	request: { raw: Request } & Validators;
	/** State staged for the response. */
	response: ContextResponse;
	/** Application server instance. */
	server: NonNullable<Cudenix["server"]>;
	/** Values accumulated by store handlers. */
	store: Stores;
}

/**
 * Any {@link Context} regardless of its store or validator generics.
 */
export type AnyContext = Context<any, any>;
