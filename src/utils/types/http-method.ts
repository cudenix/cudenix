/**
 * Represents HTTP method names.
 *
 * @example
 * ```typescript
 * type A = "GET" extends HttpMethod ? true : false; // true
 * type B = "PURGE" extends HttpMethod ? true : false; // true
 * ```
 */
export type HttpMethod =
	| "CONNECT"
	| "DELETE"
	| "GET"
	| "HEAD"
	| "OPTIONS"
	| "PATCH"
	| "POST"
	| "PUT"
	| "QUERY"
	| "TRACE"
	// accepts any method while keeping autocomplete
	| (string & NonNullable<unknown>);
