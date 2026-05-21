/**
 * @module
 * HTTP method literal union accepted by the router.
 */

/**
 * Union of every HTTP method recognized by the router, plus a string brand
 * for custom verbs.
 *
 * The trailing `Uppercase<string> & NonNullable<unknown>` keeps the named
 * methods as autocomplete suggestions while still accepting arbitrary
 * upper-case strings — handy for non-standard verbs without losing literal
 * inference. `"WS"` is the synthetic method used to register WebSocket
 * upgrade handlers on the same routing surface as HTTP routes.
 *
 * @example
 * ```typescript
 * type A = HttpMethod; // "DELETE" | "GET" | "HEAD" | ... | "WS" | (Uppercase<string> & {})
 * type B = "GET" extends HttpMethod ? true : false;    // true (suggested literal)
 * type C = "PURGE" extends HttpMethod ? true : false;  // true (via string brand)
 * type D = "WS" extends HttpMethod ? true : false;     // true (WebSocket upgrade)
 * type E = "get" extends HttpMethod ? true : false;    // false (must be upper-case)
 * ```
 */
export type HttpMethod =
	| "DELETE"
	| "GET"
	| "HEAD"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT"
	| "WS"
	| (Uppercase<string> & NonNullable<unknown>);
