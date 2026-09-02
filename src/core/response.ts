import type { ContextResponse } from "@/core/context";

const NOT_CONTENT = new Response(undefined, { status: 204 });

const ARRAY_PROTOTYPE = Array.prototype;
const OBJECT_PROTOTYPE = Object.prototype;

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
 * Applies staged headers to a response that already carries its own.
 */
const applyHeaders = (
	result: Response,
	headers: ContextResponse["headers"],
) => {
	headers.forEach(applyHeader, result);

	return result;
};

/**
 * Content kinds {@link classifyContent} resolves to.
 */
const CONTENT_JSON = 0;
const CONTENT_RESPONSE = 1;
const CONTENT_BODY = 2;

/**
 * Resolves how content materializes.
 */
const classifyContent = (inner: unknown) => {
	if (typeof inner !== "object") {
		return CONTENT_BODY;
	}

	const prototype = Object.getPrototypeOf(inner);

	if (
		prototype === OBJECT_PROTOTYPE ||
		prototype === ARRAY_PROTOTYPE ||
		prototype === null
	) {
		return CONTENT_JSON;
	}

	if (inner instanceof Response) {
		return CONTENT_RESPONSE;
	}

	// a constructor named Object, Array or absent serializes as JSON
	const name = (inner as object).constructor?.name;

	if (name === undefined || name === "Object" || name === "Array") {
		return CONTENT_JSON;
	}

	return name === "Response" ? CONTENT_RESPONSE : CONTENT_BODY;
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

	const kind = classifyContent(inner);

	if (kind === CONTENT_JSON) {
		// omit the init at the default status
		return status === 200
			? Response.json(inner)
			: Response.json(inner, { status });
	}

	if (kind === CONTENT_RESPONSE) {
		return (inner as Response).clone();
	}

	return status === 200
		? new Response(inner as BodyInit)
		: new Response(inner as BodyInit, { status });
};

/**
 * Materializes response content, folding staged headers into construction.
 */
const materializeStaged = (
	content: ContextResponse["content"],
	headers: ContextResponse["headers"],
) => {
	if (!content) {
		return new Response(undefined, { headers, status: 204 });
	}

	if (content instanceof ReadableStream) {
		// staged headers land on top of the stream defaults
		return applyHeaders(new Response(content, STREAM_INIT), headers);
	}

	const inner = content.content;

	if (inner === null || inner === undefined) {
		return new Response(undefined, { headers, status: 204 });
	}

	const status = content.status;

	const kind = classifyContent(inner);

	if (kind === CONTENT_JSON) {
		// the init carries the staged headers
		return Response.json(inner, { headers, status });
	}

	if (kind === CONTENT_RESPONSE) {
		// staged headers land on top of the clone's
		return applyHeaders((inner as Response).clone(), headers);
	}

	return new Response(inner as BodyInit, { headers, status });
};

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
) =>
	applyCookies(
		// empty staged headers take the plain path
		headers?.count
			? materializeStaged(content, headers)
			: materialize(content),
		cookies,
	);
