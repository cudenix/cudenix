import type { ContextResponse } from "@/core/context";

const NOT_CONTENT = new Response(undefined, { status: 204 });

/**
 * Append every staged `Set-Cookie` header from `cookies` onto `result` and
 * return it. Bun's `CookieMap` only emits headers for cookies a handler `set`
 * or `delete`d — cookies merely read from the incoming request are never
 * echoed back — so an untouched map yields an empty list and appends nothing.
 *
 * @example
 * ```typescript
 * const cookies = new Bun.CookieMap();
 *
 * cookies.set("a", "v1");
 *
 * const a = applyCookies(new Response(), cookies);
 *
 * a.headers.getSetCookie(); // ["a=v1; Path=/; SameSite=Lax"]
 * ```
 */
const applyCookies = (
	result: Response,
	cookies?: ContextResponse["cookies"],
) => {
	if (!cookies) {
		return result;
	}

	const setCookieHeaders = cookies.toSetCookieHeaders();

	for (let i = 0; i < setCookieHeaders.length; i++) {
		result.headers.append("set-cookie", setCookieHeaders[i]!);
	}

	return result;
};

/**
 * Fold every staged `headers` entry onto `result` exactly once and return it.
 * Most headers `set` (override) — a handler staging `content-type` is meant to
 * replace the body's inferred one, and `cors`'s single-valued
 * `access-control-*` headers each have one final value — but `vary` `append`s,
 * because it is list-valued and a chain accumulates it across plugins (`cors`
 * stages `Origin`, `compress` puts `Accept-Encoding` on the body it materializes
 * and `Headers` coalesces both into one `vary: Accept-Encoding, Origin`). Staged
 * headers are folded ONLY here, never in {@link processResponse}, so no value is
 * doubled. `set-cookie` never travels through staged `headers` — it lives on
 * `cookies` and is applied by {@link applyCookies} — so the two never collide.
 *
 * @example
 * ```typescript
 * const headers = new Headers();
 *
 * headers.set("access-control-allow-origin", "*");
 *
 * const a = applyHeaders(new Response(), headers);
 *
 * a.headers.get("access-control-allow-origin"); // "*"
 * ```
 */
const applyHeaders = (
	result: Response,
	headers?: ContextResponse["headers"],
) => {
	if (!headers) {
		return result;
	}

	for (const [name, value] of headers) {
		if (name === "vary") {
			result.headers.append(name, value);
		} else {
			result.headers.set(name, value);
		}
	}

	return result;
};

/**
 * Materialize a {@link ContextResponse} `content` value into a `Response` — a
 * `ReadableStream` becomes a `text/event-stream`, a missing or empty body
 * becomes `204`, a handler-returned raw `Response` is cloned through with its
 * own status and headers, and a reply envelope is serialized by its content's
 * constructor. The staged response `headers` and `cookies` are NOT folded here;
 * both {@link processResponse} and {@link response} share this body+status core.
 *
 * @example
 * ```typescript
 * const a = materialize(ok({ a: "v1" }));
 *
 * a.status; // 200
 *
 * const b = materialize(undefined);
 *
 * b.status; // 204
 * ```
 */
const materialize = (content: ContextResponse["content"]): Response => {
	if (!content) {
		return NOT_CONTENT.clone();
	}

	if (content instanceof ReadableStream) {
		return new Response(content, {
			headers: {
				"cache-control": "no-cache",
				connection: "keep-alive",
				"content-type": "text/event-stream",
			},
		});
	}

	const inner = content.content;

	if (inner === null || inner === undefined) {
		return NOT_CONTENT.clone();
	}

	switch (inner.constructor?.name) {
		case "Response":
			return (inner as Response).clone();

		case "Array":
		case "Object":
		case undefined:
			return Response.json(inner, { status: content.status });

		default:
			return new Response(inner as BodyInit, { status: content.status });
	}
};

/**
 * Materialize `response.content` into a real `Response` with a mutable
 * `Headers`, body, and status — WITHOUT folding the staged `response.headers`
 * or cookies. `compress` calls this to inspect and rewrite the body's own
 * headers (`content-type`, `content-length`, `vary`) before re-wrapping the
 * result as a fresh reply envelope; the staged response headers (CORS etc.) and
 * cookies are layered on later, exactly once, by {@link response} on the
 * serialize path. Folding staged headers here would double them, because the
 * re-wrapped envelope flows back through {@link response} a second time.
 *
 * @example
 * ```typescript
 * const a = processResponse({
 *   content: ok({ a: "v1" }),
 *   cookies: new Bun.CookieMap(),
 *   headers: new Headers(),
 * });
 *
 * a.headers.get("content-type"); // "application/json;charset=utf-8"
 * ```
 */
export const processResponse = (response: ContextResponse): Response =>
	materialize(response.content);

/**
 * Build the final `Response` from a {@link ContextResponse} `content` value,
 * then fold the staged `headers` (CORS etc.) and `cookies` onto it exactly once.
 * `headers` and `cookies` are omitted only for a request-independent static
 * response that `compile` builds once without a context.
 *
 * @example
 * ```typescript
 * const a = response(ok({ a: "v1" }), new Bun.CookieMap(), new Headers());
 *
 * a.status; // 200
 *
 * const b = response(undefined);
 *
 * b.status; // 204
 * ```
 */
export const response = (
	content: ContextResponse["content"],
	cookies?: ContextResponse["cookies"],
	headers?: ContextResponse["headers"],
) => applyCookies(applyHeaders(materialize(content), headers), cookies);
