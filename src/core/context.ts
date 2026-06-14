import type { Cudenix, Endpoint } from "@/core/cudenix";
import type { AnyFail, AnyOk } from "@/core/reply";
import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Per-request Context plus its developer-facing view.
 */

/**
 * Developer-facing view of {@link Context} handed to middlewares, stores,
 * validators, and route handlers.
 *
 * @example
 * ```typescript
 * const fn = (context: DeveloperContext<{ a: string }, {}>) => {
 *   context.store.a; // string
 *   context.request.raw; // Request
 * };
 * ```
 */
export type DeveloperContext<
	Stores extends Record<PropertyKey, unknown>,
	Validators extends Record<PropertyKey, unknown>,
> = Omit<Context<Stores, Validators>, "endpoint" | "match">;

/**
 * Any {@link DeveloperContext} regardless of its store or validator generics.
 * Use it where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const fn = (context: AnyDeveloperContext) => context.response.headers;
 * ```
 */
export type AnyDeveloperContext = DeveloperContext<any, any>;

/**
 * Response envelope on `context.response`.
 *
 * @example
 * ```typescript
 * const a: ContextResponse = {
 *   content: ok({ a: "v1" }),
 *   cookies: { b: "v2" },
 *   headers: { c: "v3" },
 * };
 * ```
 */
export interface ContextResponse {
	content?: AnyFail | AnyOk | ReadableStream;
	cookies: Record<string, string>;
	headers: Record<string, string>;
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
	endpoint: Endpoint;
	match?: RegExpExecArray;
	memory: Cudenix["memory"];
	request: { raw: Request } & Validators;
	response: ContextResponse;
	server: NonNullable<Cudenix["server"]>;
	store: Stores;
}

/**
 * Any {@link Context} regardless of its store or validator generics. Use it
 * where the concrete generics are irrelevant.
 *
 * @example
 * ```typescript
 * const a: AnyContext = new Context(app, endpoint, request);
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
 * const a = new Ctor(app, endpoint, request);
 *
 * a.endpoint; // endpoint
 * ```
 */
export interface ContextConstructor {
	new (
		app: Cudenix,
		endpoint: Endpoint,
		request: Request,
		match?: RegExpExecArray,
	): AnyContext;
}

/**
 * Build a {@link Context} for a single request. Must be invoked with `new`.
 *
 * @example
 * ```typescript
 * const a = new Context(app, endpoint, request, match);
 *
 * a.request.raw; // request
 * a.response.headers; // {}
 * ```
 */
export const Context = function (
	this: AnyContext,
	app: Cudenix,
	endpoint: Endpoint,
	request: Request,
	match?: RegExpExecArray,
) {
	this.endpoint = endpoint;
	this.match = match;
	this.memory = app.memory;
	this.request = new Empty() as unknown as AnyContext["request"];
	this.response = new Empty() as unknown as AnyContext["response"];
	this.server = app.server!;
	this.store = new Empty();

	this.request.raw = request;

	this.response.cookies = new Empty() as ContextResponse["cookies"];
	this.response.headers = new Empty() as ContextResponse["headers"];
} as unknown as ContextConstructor;
