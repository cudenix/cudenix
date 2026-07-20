import type { ContextResponse } from "@/core/context";

const NOT_CONTENT = new Response(undefined, { status: 204 });

/**
 * Applies staged cookies to a response.
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
 * Applies staged headers to a response.
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
 * Materializes response content.
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
 * Materializes the content of a {@link ContextResponse}.
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
 * Builds the final `Response` with staged cookies and headers.
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
