import type { ContextResponse } from "@/core/context";

export const processResponse = (response: ContextResponse) => {
	if (response.cookies.size > 0) {
		const setCookieHeaders = response.cookies.toSetCookieHeaders();

		for (let i = 0; i < setCookieHeaders.length; i++) {
			const setCookieHeader = setCookieHeaders[i];

			if (!setCookieHeader) {
				continue;
			}

			response.headers.append("set-cookie", setCookieHeader);
		}
	}

	const content = response.content;

	if (content instanceof ReadableStream) {
		response.headers.set("cache-control", "no-cache");
		response.headers.set("connection", "keep-alive");

		if (!response.headers.has("content-type")) {
			response.headers.set("content-type", "text/event-stream");
		}

		return new Response(content, {
			headers: response.headers,
		});
	}

	if (!content) {
		return new Response(undefined, {
			headers: response.headers,
			status: 204,
		});
	}

	if (content.content instanceof Response) {
		const original = content.content;

		for (const [key, value] of response.headers) {
			original.headers.append(key, value);
		}

		return original;
	}

	if (content.transform) {
		return Response.json(
			{
				content: content.content,
				status: content.status,
				success: content.success,
			},
			{
				headers: response.headers,
				status: content.status,
			},
		);
	}

	return new Response(content.content, {
		headers: response.headers,
		status: content.status,
	});
};
