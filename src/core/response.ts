import type { ContextResponse } from "@/core/context";
import { FrozenEmpty } from "@/utils/objects/empty";

interface ProcessResponseOptions {
	serializeCookies?: boolean;
}

export const processResponse = (
	response: ContextResponse,
	{ serializeCookies }: ProcessResponseOptions = FrozenEmpty,
) => {
	if (
		serializeCookies &&
		(response as any)._cookies &&
		response.cookies.size > 0
	) {
		const setCookieHeaders = response.cookies.toSetCookieHeaders();

		for (let i = 0; i < setCookieHeaders.length; i++) {
			response.headers.append("set-cookie", setCookieHeaders[i]!);
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

	const headers = (response as any)._headers;

	if (!content) {
		return new Response(undefined, { headers, status: 204 });
	}

	const inner = content.content;
	const status = content.status;

	if (inner === null || inner === undefined) {
		return new Response(inner as null, { headers, status });
	}

	switch (inner.constructor?.name) {
		case "Response": {
			const res = inner as Response;

			if (!headers) {
				return res;
			}

			for (const [key, value] of headers) {
				res.headers.append(key, value);
			}

			return res;
		}

		case "String":
		case "ReadableStream":
		case "Blob":
		case "File":
		case "ArrayBuffer":
		case "DataView":
		case "Buffer":
		case "Uint8Array":
		case "Uint8ClampedArray":
		case "Int8Array":
		case "Uint16Array":
		case "Int16Array":
		case "Uint32Array":
		case "Int32Array":
		case "Float32Array":
		case "Float64Array":
		case "BigInt64Array":
		case "BigUint64Array":
		case "FormData":
		case "URLSearchParams":
			return new Response(inner as BodyInit, { headers, status });

		default:
			return Response.json(inner, { headers, status });
	}
};
