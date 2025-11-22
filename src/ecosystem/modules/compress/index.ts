import { module, processResponse, success } from "@/core";
import { Empty } from "@/utils";

export interface CompressOptions {
	threshold?: number;
}

const compressibleRegexp =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;
const noTransformRegexp = /\bno-transform\b/i;

export const compress = (
	{ threshold = 1024 }: CompressOptions = new Empty(),
) => {
	const encodings = {
		br: "brotli",
		deflate: "deflate",
		gzip: "gzip",
		zstd: "zstd",
	} as const;

	return module().middleware(async ({ request: { raw }, response }, next) => {
		await next();

		const contentLength = response.headers.get("Content-Length");

		if (
			!response.content ||
			raw.method === "HEAD" ||
			noTransformRegexp.test(
				response.headers.get("Cache-Control") ?? "",
			) ||
			raw.headers.has("Range") ||
			response.headers.has("Content-Encoding") ||
			response.headers.has("Content-Range") ||
			response.headers.has("Transfer-Encoding") ||
			(contentLength && Number(contentLength) < threshold)
		) {
			return;
		}

		const accepted = [
			...new Set(
				raw.headers
					.get("Accept-Encoding")
					?.split(",")
					.map((encoding) => {
						return encoding.trim().toLowerCase().split(";")[0];
					})
					.filter((encoding): encoding is string => {
						return !!encoding;
					}),
			),
		];

		if (accepted.length === 0) {
			return;
		}

		const encoding = accepted
			.map((encoding) => {
				return encodings[encoding as keyof typeof encodings];
			})
			.find((encoding) => {
				return !!encoding;
			});

		if (!encoding) {
			return;
		}

		const processedResponse = await processResponse(response);

		const contentType = processedResponse.headers.get("Content-Type");

		if (!contentType || !compressibleRegexp.test(contentType)) {
			return;
		}

		let stream = processedResponse.body;

		if (!stream) {
			const buffer = await processedResponse.arrayBuffer();

			if (buffer.byteLength < threshold) {
				return;
			}

			stream = new Response(buffer).body;
		}

		if (!stream) {
			return;
		}

		processedResponse.headers.append("Vary", "Accept-Encoding");

		processedResponse.headers.delete("Content-Length");

		processedResponse.headers.set("Content-Encoding", encoding);

		response.content = success(
			new Response(
				// @ts-expect-error
				stream.pipeThrough(new CompressionStream(encoding)),
				processedResponse,
			),
			{
				status: processedResponse.status,
				transform: false,
			},
		);
	});
};
