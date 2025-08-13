import type { ContextResponse } from "@/context";

const MAX_ITERATIONS = 10;

export const processResponse = async ({
	content,
	headers,
}: ContextResponse): Promise<Response> => {
	let iterations = 0;

	while (typeof content === "function" || content instanceof Promise) {
		if (iterations++ > MAX_ITERATIONS) {
			break;
		}

		if (typeof content === "function") {
			content = (content as () => any)();
		} else {
			content = await content;
		}
	}

	if (content instanceof ReadableStream) {
		headers.set("Cache-Control", "no-cache");
		headers.set("Connection", "keep-alive");
		headers.set("Content-Type", "text/event-stream");

		return new Response(content, {
			headers,
		});
	}

	if (content?.content instanceof Response) {
		return content.content;
	}

	if (content?.transform) {
		return Response.json(
			{
				...content,
				transform: undefined,
			},
			{
				headers,
				status: content.status,
			},
		);
	}

	return new Response(content?.content, {
		headers,
		status: content?.status,
	});
};
