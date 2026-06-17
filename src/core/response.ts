import type { ContextResponse } from "@/core/context";

const NOT_CONTENT = new Response(undefined, { status: 204 });

/**
 * Build a `Response` from a {@link ContextResponse} `content` value — a
 * `ReadableStream` becomes a `text/event-stream`, a missing or empty body
 * becomes `204`, and a reply envelope is serialized by its content's
 * constructor.
 *
 * @example
 * ```typescript
 * const a = response(ok({ a: "v1" }));
 *
 * a.status; // 200
 *
 * const b = response(undefined);
 *
 * b.status; // 204
 * ```
 */
export const response = (content: ContextResponse["content"]) => {
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
