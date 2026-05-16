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
 * const method: HttpMethod = "GET"; // suggested
 * const custom: HttpMethod = "PURGE"; // accepted via the string brand
 * const ws: HttpMethod = "WS"; // WebSocket upgrade handler
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
