import type { ContextResponse } from "@/core/context";
import { FreezeEmpty } from "@/utils/objects/empty";

interface ProcessResponseOptions {
	serializeCookies?: boolean;
}

export const processResponse = (
	response: ContextResponse,
	{ serializeCookies }: ProcessResponseOptions = FreezeEmpty,
) => {
	if (serializeCookies && response.cookies.size > 0) {
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
		const headers = response.headers;

		headers.set("cache-control", "no-cache");
		headers.set("connection", "keep-alive");

		if (!headers.has("content-type")) {
			headers.set("content-type", "text/event-stream");
		}

		return new Response(content, { headers });
	}

	const headers = Object.hasOwn(response, "headers")
		? response.headers
		: undefined;

	if (!content) {
		return new Response(undefined, {
			headers,
			status: 204,
		});
	}

	if (content.content instanceof Response) {
		if (!headers) {
			return content.content;
		}

		const original = content.content;

		for (const [key, value] of headers) {
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
				headers,
				status: content.status,
			},
		);
	}

	return new Response(content.content, {
		headers,
		status: content.status,
	});
};
