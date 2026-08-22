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
 *
 * Replaces a `constructor?.name` switch. That call site sees every reply shape
 * an app produces, so the property read is megamorphic and JSC cannot
 * inline-cache it, and it then compares interned strings; the common cases here
 * are pointer compares instead.
 *
 * The pointer compares settle the shapes an app actually returns; anything
 * else falls through to the original `constructor` rule, so no reply changes
 * how it serializes.
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

	// everything else keeps the original rule, which resolved `constructor`
	// through the whole chain: a value whose constructor is Object, Array or
	// absent serializes as JSON. That covers Empty dictionaries, Bun's native
	// route params, objects delegating to a plain object, and cross-realm
	// arrays -- none of which the pointer compares above can see.
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
		// 200 is the constructor default, and omitting the init skips parsing it
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
 *
 * Mirrors the branches of {@link materialize}: every branch that builds a fresh
 * response carries the headers in its init, and the two that inherit headers
 * from elsewhere merge the staged ones on top instead.
 */
const materializeStaged = (
	content: ContextResponse["content"],
	headers: ContextResponse["headers"],
) => {
	if (!content) {
		return new Response(undefined, { headers, status: 204 });
	}

	if (content instanceof ReadableStream) {
		// the stream defaults are overridable, so staged headers land on top
		return applyHeaders(new Response(content, STREAM_INIT), headers);
	}

	const inner = content.content;

	if (inner === null || inner === undefined) {
		return new Response(undefined, { headers, status: 204 });
	}

	const status = content.status;

	const kind = classifyContent(inner);

	if (kind === CONTENT_JSON) {
		// one native copy, where a built response costs a crossing per header
		return Response.json(inner, { headers, status });
	}

	if (kind === CONTENT_RESPONSE) {
		// the clone brings its own headers, so staged ones land on top
		return applyHeaders((inner as Response).clone(), headers);
	}

	return new Response(inner as BodyInit, { headers, status });
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
) =>
	applyCookies(
		// an empty staged set costs more to hand to an init than to skip
		headers?.count
			? materializeStaged(content, headers)
			: materialize(content),
		cookies,
	);
