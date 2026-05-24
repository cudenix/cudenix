/**
 * @module
 * Type-level catalog of HTTP methods the router recognizes — every canonical
 * verb as a named literal, plus a string brand that keeps arbitrary
 * upper-case verbs assignable without losing literal inference.
 *
 * Use {@link HttpMethod} anywhere a method name flows through the public
 * surface — route builders, per-verb middleware,
 * client-side helpers — when you want named verbs to drive autocomplete
 * while still allowing custom upper-case verbs like `"PURGE"`, `"REPORT"`,
 * or vendor-specific extensions to type-check.
 */

/**
 * Resolve to the union of every HTTP verb the router recognizes by name,
 * plus the string brand `Uppercase<string>` that accepts any other
 * upper-case verb without widening the slot to plain `string`.
 *
 * Behavior worth knowing before you reach for it:
 *
 * - **Named verbs drive autocomplete** — the canonical methods are listed
 *   as explicit literals so editors surface them as suggestions, even
 *   though the brand alone would already accept them.
 * - **`"WS"` is the synthetic WebSocket verb** — the router registers
 *   WebSocket upgrade handlers on the same routing surface as HTTP
 *   routes, and `"WS"` is the method literal that targets that surface.
 * - **Custom verbs must be upper-case** — the brand is
 *   `Uppercase<string>`, so `"purge"`, `"Get"`, or `"gEt"` are rejected
 *   at compile time. Upper-case the verb before it reaches the type.
 * - **Hyphens, underscores, and digits pass through** — the brand only
 *   constrains case, so verbs like `"X-CUSTOM"`, `"X_CUSTOM"`, or
 *   `"HTTP2"` satisfy it without extra ceremony.
 * - **The empty string is accepted** — `""` is vacuously upper-case and
 *   satisfies the brand at the type level. Filter at runtime if you need
 *   to forbid an empty verb.
 * - **Literal types are preserved** — assigning a literal such as `"GET"`
 *   keeps that literal in the inferred type instead of widening it to
 *   `string`, so downstream conditional types can still discriminate on
 *   the specific verb.
 * - **Plain `string` is not assignable** — the brand is narrower than
 *   `string`, so a value typed as `string` must be narrowed (or
 *   asserted) before it can flow into a slot typed as `HttpMethod`.
 *
 * @example
 * The named literals and the brand together cover both autocompleted
 * verbs and arbitrary upper-case custom verbs.
 * ```typescript
 * type A = "GET" extends HttpMethod ? true : false;
 * // true
 *
 * type B = "PURGE" extends HttpMethod ? true : false;
 * // true
 *
 * type C = "WS" extends HttpMethod ? true : false;
 * // true
 * ```
 * @example
 * Lower-case, capitalized, and mixed-case verbs are all rejected — the
 * brand enforces upper-case at the type level.
 * ```typescript
 * type A = "get" extends HttpMethod ? true : false;
 * // false
 *
 * type B = "Get" extends HttpMethod ? true : false;
 * // false
 *
 * type C = "gEt" extends HttpMethod ? true : false;
 * // false
 * ```
 * @example
 * Hyphens, underscores, and digits are part of the brand's allowed
 * character set, so vendor- and protocol-specific verbs type-check
 * without ceremony.
 * ```typescript
 * type A = "X-CUSTOM" extends HttpMethod ? true : false;
 * // true
 *
 * type B = "X_CUSTOM" extends HttpMethod ? true : false;
 * // true
 *
 * type C = "HTTP2" extends HttpMethod ? true : false;
 * // true
 * ```
 * @example
 * Plain `string` is too wide to satisfy the brand, but every member of
 * `HttpMethod` is still a `string` — narrow or assert before passing a
 * `string` value into an `HttpMethod` slot.
 * ```typescript
 * type A = string extends HttpMethod ? true : false;
 * // false
 *
 * type B = HttpMethod extends string ? true : false;
 * // true
 * ```
 * @example
 * Non-string types — numbers, booleans, `null`, `undefined` — are
 * rejected outright, since the brand still requires a string value.
 * ```typescript
 * type A = 1 extends HttpMethod ? true : false;
 * // false
 *
 * type B = true extends HttpMethod ? true : false;
 * // false
 *
 * type C = null extends HttpMethod ? true : false;
 * // false
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
