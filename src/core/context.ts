import type { Cudenix, Endpoint } from "@/core/cudenix";
import type { AnyError } from "@/core/error";
import type { AnySuccess } from "@/core/success";
import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Per-request Context — the runtime object threaded through every chain link,
 * plus the developer-facing view that hides the framework's internal plumbing.
 */

/**
 * Developer-facing view of {@link Context} handed to middlewares, stores,
 * validators, and route handlers. Strips the fields the runtime keeps for
 * itself — `endpoint`, `match`, and the reserved `parseRequest*` keys — so
 * user code sees only `memory`, `request`, `response`, `server`, and `store`.
 *
 * Reach for it as the `context` parameter type of a {@link StoreFn},
 * {@link MiddlewareFn}, or route handler; the omitted keys are never meant to
 * be touched from application code.
 *
 * @typeParam Stores - Shape of `context.store` visible at this point.
 * @typeParam Validators - Shape of the validated request fields on `context.request`.
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
> = Omit<
	Context<Stores, Validators>,
	| "endpoint"
	| "match"
	| "parseRequestBody"
	| "parseRequestCookies"
	| "parseRequestHeaders"
	| "parseRequestParams"
	| "parseRequestQuery"
>;

/**
 * Wildcard alias matching any {@link DeveloperContext} regardless of its
 * store or validator generics. Reach for it in plugin and boundary types
 * where the concrete generics are irrelevant — for example, a CORS handler
 * that only touches `context.response.headers`.
 *
 * @example
 * ```typescript
 * const fn = (context: AnyDeveloperContext) => context.response.headers;
 * ```
 */
export type AnyDeveloperContext = DeveloperContext<any, any>;

/**
 * Response envelope carried on `context.response`, accumulating what the
 * runtime will serialize once the chain settles. Chain links write into it as
 * they run — stores and middlewares set `content`, plugins layer on headers
 * and cookies — and the final value is read back when the `Response` is built.
 *
 * Fields:
 *
 * - `content` — the {@link AnyError}, {@link AnySuccess}, or `ReadableStream`
 *   that becomes the response body; absent until something produces one.
 * - `cookies` — `Set-Cookie` values keyed by cookie name.
 * - `headers` — response headers keyed by header name.
 *
 * @example
 * ```typescript
 * const a: ContextResponse = {
 *   content: new Success({ a: "v1" }),
 *   cookies: { b: "v2" },
 *   headers: { c: "v3" },
 * };
 * ```
 */
export interface ContextResponse {
	content?: AnyError | AnySuccess | ReadableStream;
	cookies: Record<string, string>;
	headers: Record<string, string>;
}

/**
 * Per-request state constructed once per incoming request and threaded
 * through the entire chain. Holds the matched endpoint and the framework's
 * internal bookkeeping alongside the fields application code reads via
 * {@link DeveloperContext} (`memory`, `request`, `response`, `server`,
 * `store`).
 *
 * Fields:
 *
 * - `endpoint` — the {@link Endpoint} this request resolved to.
 * - `match` — the `RegExpExecArray` from path matching, used to read URL
 *   parameters; absent for routes matched without a regular expression.
 * - `memory` — the app's shared {@link Cudenix} `memory` bag.
 * - `request` — the raw `Request` plus the validated request fields.
 * - `response` — the {@link ContextResponse} the chain writes its outcome into.
 * - `server` — the live Bun server backing the app.
 * - `store` — values accumulated by `.store()` links so far.
 *
 * @typeParam Stores - Shape of `context.store` for this request.
 * @typeParam Validators - Shape of the validated request fields on `context.request`.
 * @example
 * ```typescript
 * const fn = (context: Context<{ a: string }, {}>) => {
 *   context.store.a; // string
 *   context.response.content = new Success({ a: "v1" });
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
 * Wildcard alias matching any {@link Context} regardless of its store or
 * validator generics. Reach for it where the concrete generics are erased —
 * for example, the chain walker, which dispatches over links without knowing
 * each request's exact store and validator shapes.
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
 * Constructor signature of {@link Context}, declared separately so the
 * runtime value can be defined with a plain `function` and cast to a
 * constructable type.
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
 * Construct a {@link Context} for a single request. Must be invoked with
 * `new`; pulls `memory` and `server` off the app, records the resolved
 * `endpoint` and optional `match`, and seeds `request`, `response`, and
 * `store` ready for the chain to fill in.
 *
 * `request`, `response`, and `store` start as prototype-free {@link Empty}
 * dictionaries; the raw `Request` is wired onto `request.raw`, and
 * `response.cookies`/`response.headers` are pre-seeded as empty maps while
 * `response.content` is left unset until a link produces one. `server` is
 * read with a non-null assertion, so the app must already be listening.
 *
 * @param app - The {@link Cudenix} app supplying `memory` and `server`.
 * @param endpoint - The {@link Endpoint} this request resolved to.
 * @param request - The incoming `Request`, stored on `request.raw`.
 * @param match - Optional path-match result used to read URL parameters.
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
