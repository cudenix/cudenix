/**
 * @module
 * HTTP method literals plus an open string brand for custom verbs.
 */

/**
 * Union of the common routable HTTP verbs and any other string. Named
 * literals drive editor autocomplete; the `string & NonNullable<unknown>`
 * intersection keeps other verbs like `"CONNECT"`, `"TRACE"`, `"PURGE"`, or
 * `"X-CUSTOM"` assignable without collapsing the named literals into plain
 * `string` — which would drop the suggestions.
 *
 * Any string is accepted, including lower- and mixed-case verbs; normalise the
 * case elsewhere when a canonical form is required.
 *
 * @example
 * ```typescript
 * type A = "GET" extends HttpMethod ? true : false; // true
 * type B = "PURGE" extends HttpMethod ? true : false; // true
 * type C = "get" extends HttpMethod ? true : false; // true
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
	| (string & NonNullable<unknown>);
