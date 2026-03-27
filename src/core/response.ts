import type { ContextResponse } from "@/core/context";

export const processResponse = (response: ContextResponse) => {
	if ((response as unknown as { _cookiesInit: boolean })._cookiesInit) {
		const setCookieHeaders = response.cookies.toSetCookieHeaders();

		for (let i = 0; i < setCookieHeaders.length; i++) {
			const setCookieHeader = setCookieHeaders[i];

			if (!setCookieHeader) {
				continue;
			}

			response.headers.append("Set-Cookie", setCookieHeader);
		}
	}

	const content = response.content;

	if (content instanceof ReadableStream) {
		response.headers.set("Cache-Control", "no-cache");
		response.headers.set("Connection", "keep-alive");

		if (!response.headers.has("Content-Type")) {
			response.headers.set("Content-Type", "text/event-stream");
		}

		return new Response(content, {
			headers: response.headers,
		});
	}

	if (!content) {
		return new Response(undefined, {
			headers: response.headers,
		});
	}

	if (content.content instanceof Response) {
		const original = content.content;

		response.headers.forEach((value, key) => {
			original.headers.append(key, value);
		});

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
