/**
 * @module
 * HTTP method literals plus an upper-case string brand for custom verbs.
 */

/**
 * Union of canonical HTTP verbs (plus `"WS"` for WebSocket upgrades) and any
 * other upper-case string. Named literals drive editor autocomplete; the
 * `Uppercase<string>` brand keeps custom verbs like `"PURGE"` or `"X-CUSTOM"`
 * assignable without widening to plain `string`.
 *
 * Lower-case or mixed-case verbs (`"get"`, `"Get"`) are rejected at compile
 * time — upper-case the verb before it reaches this type.
 *
 * @example
 * ```typescript
 * type A = "GET" extends HttpMethod ? true : false; // true
 * type B = "PURGE" extends HttpMethod ? true : false; // true
 * type C = "get" extends HttpMethod ? true : false; // false
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
