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
	const status = content.status;

	if (inner === null || inner === undefined) {
		return NOT_CONTENT.clone();
	}

	switch (inner.constructor?.name) {
		case "Response":
			return inner as Response;

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
		case "Int16Array":
		case "Uint16Array":
		case "Uint32Array":
		case "Int32Array":
		case "Float32Array":
		case "Float64Array":
		case "BigInt64Array":
		case "BigUint64Array":
		case "FormData":
		case "URLSearchParams":
			return new Response(inner as BodyInit, { status });

		default:
			return Response.json(inner, { status });
	}
};
