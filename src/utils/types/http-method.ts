/**
 * Union of the common HTTP verbs and any other string, allowing custom
 * verbs like `"PURGE"`.
 *
 * @example
 * ```typescript
 * type A = "GET" extends HttpMethod ? true : false; // true
 * type B = "PURGE" extends HttpMethod ? true : false; // true
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
