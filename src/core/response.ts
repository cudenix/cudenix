import type { ContextResponse } from "@/core/context";

export const processResponse = async (
	response: ContextResponse,
): Promise<Response> => {
	const setCookieHeaders = response.cookies.toSetCookieHeaders();

	for (let i = 0; i < setCookieHeaders.length; i++) {
		const setCookieHeader = setCookieHeaders[i];

		if (!setCookieHeader) {
			continue;
		}

		response.headers.append("Set-Cookie", setCookieHeader);
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
