import type { ContextResponse } from "@/core/context";

const NOT_CONTENT = new Response(undefined, { status: 204 });

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
			return inner as Response;

		case "Array":
		case "Object":
			return Response.json(inner, { status: content.status });

		default:
			return new Response(inner as BodyInit, { status: content.status });
	}
};
