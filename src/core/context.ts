import type { Cudenix } from "@/core/cudenix";
import type { AnyFail, AnyOk } from "@/core/reply";
import { Empty } from "@/utils/objects/empty";

/**
 * Response envelope on `context.response`.
 *
 * @example
 * ```typescript
 * const a: ContextResponse = {
 *   content: ok({ a: "v1" }),
 *   cookies: new Bun.CookieMap(),
 *   headers: new Headers(),
 * };
 * ```
 */
export interface ContextResponse {
	content?: AnyFail | AnyOk | ReadableStream;
	cookies: Bun.CookieMap;
	headers: Headers;
}

/**
 * Per-request state holding the matched endpoint and framework bookkeeping.
 *
 * @example
 * ```typescript
 * const fn = (context: Context<{ a: string }, {}>) => {
 *   context.store.a; // string
 *   context.response.content = ok({ a: "v1" });
 * };
 * ```
 */
export interface Context<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> {
	match?: RegExpExecArray;
	memory: Cudenix["memory"];
	request: { raw: Request } & Validators;
	response: ContextResponse;
	server: NonNullable<Cudenix["server"]>;
	store: Stores;
}

/**
 * Any {@link Context} regardless of its store or validator generics.
 *
 * @example
 * ```typescript
 * const a: AnyContext = new Context(app, request);
 *
 * a.request.raw; // Request
 * ```
 */
export type AnyContext = Context<any, any>;

/**
 * Constructor signature of {@link Context}.
 *
 * @example
 * ```typescript
 * const Ctor: ContextConstructor = Context;
 *
 * const a = new Ctor(app, request);
 *
 * a.request.raw; // request
 * ```
 */
export interface ContextConstructor {
	new (app: Cudenix, request: Request, match?: RegExpExecArray): AnyContext;
}

/**
 * Build a {@link Context} for a single request.
 *
 * @example
 * ```typescript
 * const a = new Context(app, request, match);
 *
 * a.request.raw; // request
 * a.response.headers; // Headers {}
 * ```
 */
export const Context = function (
	this: AnyContext,
	app: Cudenix,
	request: Request,
	match?: RegExpExecArray,
) {
	this.match = match;
	this.memory = app.memory;
	this.request = new Empty() as unknown as AnyContext["request"];
	this.response = new Empty() as unknown as AnyContext["response"];
	this.server = app.server!;
	this.store = new Empty();

	this.request.raw = request;

	this.response.cookies =
		"cookies" in request
			? (request as Bun.BunRequest).cookies
			: new Bun.CookieMap(request.headers.get("cookie") ?? undefined);
	this.response.headers = new Headers();
} as unknown as ContextConstructor;
