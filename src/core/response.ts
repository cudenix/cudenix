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
 * Build a `Response` from a {@link ContextResponse} `content` value — a
 * `ReadableStream` becomes a `text/event-stream`, a missing or empty body
 * becomes `204`, and a reply envelope is serialized by its content's
 * constructor — then apply any cookies staged on `cookies` as `Set-Cookie`
 * headers. `cookies` is omitted when nothing should serialize them here: a
 * request-independent static response `compile` builds once with no context, or
 * a `BunRequest` whose `CookieMap` Bun's native router applies itself.
 *
 * @example
 * ```typescript
 * const a = response(ok({ a: "v1" }), new Bun.CookieMap());
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
) => {
	if (!content) {
		return applyCookies(NOT_CONTENT.clone(), cookies);
	}

	if (content instanceof ReadableStream) {
		return applyCookies(
			new Response(content, {
				headers: {
					"cache-control": "no-cache",
					connection: "keep-alive",
					"content-type": "text/event-stream",
				},
			}),
			cookies,
		);
	}

	const inner = content.content;

	if (inner === null || inner === undefined) {
		return applyCookies(NOT_CONTENT.clone(), cookies);
	}

	switch (inner.constructor?.name) {
		case "Response":
			return applyCookies((inner as Response).clone(), cookies);

		case "Array":
		case "Object":
		case undefined:
			return applyCookies(
				Response.json(inner, { status: content.status }),
				cookies,
			);

		default:
			return applyCookies(
				new Response(inner as BodyInit, { status: content.status }),
				cookies,
			);
	}
};
