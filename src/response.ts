import type { ContextResponse } from "@/context";

export const processResponse = async ({
	content,
	headers,
}: ContextResponse): Promise<Response> => {
	while (typeof content === "function" || content instanceof Promise) {
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
				content,
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
