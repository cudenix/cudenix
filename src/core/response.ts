import type { ContextResponse } from "@/core/context";

const NOT_CONTENT = new Response(undefined, { status: 204 });

const STREAM_INIT = {
	headers: {
		"cache-control": "no-cache",
		connection: "keep-alive",
		"content-type": "text/event-stream",
	},
};

/**
 * Applies one staged header to the response passed as `this`.
 */
function applyHeader(this: Response, value: string, name: string) {
	if (name === "vary") {
		this.headers.append(name, value);
	} else {
		this.headers.set(name, value);
	}
}

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

	headers.forEach(applyHeader, result);

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
		return new Response(content, STREAM_INIT);
	}

	const inner = content.content;

	if (inner === null || inner === undefined) {
		return NOT_CONTENT.clone();
	}

	const status = content.status;

	switch (inner.constructor?.name) {
		case "Response":
			return (inner as Response).clone();

		case "Array":
		case "Object":
		case undefined:
			// 200 is the constructor default, and omitting the init skips parsing it
			return status === 200
				? Response.json(inner)
				: Response.json(inner, { status });

		default:
			return status === 200
				? new Response(inner as BodyInit)
				: new Response(inner as BodyInit, { status });
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
