import type { ContextResponse } from "@/core";

const MAX_ITERATIONS = 10;

export const processResponse = async (
	response: ContextResponse,
): Promise<Response> => {
	let iterations = 0;

	while (
		typeof response.content === "function" ||
		response.content instanceof Promise
	) {
		if (iterations++ > MAX_ITERATIONS) {
			break;
		}

		if (typeof response.content === "function") {
			response.content = (response.content as () => any)();
		} else {
			response.content = await response.content;
		}
	}

	if (response.content instanceof ReadableStream) {
		response.headers.set("Cache-Control", "no-cache");
		response.headers.set("Connection", "keep-alive");

		if (!response.headers.has("Content-Type")) {
			response.headers.set("Content-Type", "text/event-stream");
		}

		return new Response(response.content, {
			headers: response.headers,
		});
	}

	if (response.content?.content instanceof Response) {
		return response.content.content;
	}

	if (response.content?.transform) {
		return Response.json(
			{
				...response.content,
				transform: undefined,
			},
			{
				headers: response.headers,
				status: response.content.status,
			},
		);
	}

	return new Response(response.content?.content, {
		headers: response.headers,
		status: response.content?.status,
	});
};
