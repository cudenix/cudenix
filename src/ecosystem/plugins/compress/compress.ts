import { module } from "@/core/module";
import { processResponse } from "@/core/response";
import { success } from "@/core/success";
import { selectHeader } from "@/utils/headers/select";
import { FreezeEmpty } from "@/utils/objects/empty";

export interface CompressOptions {
	threshold?: number;
}

const COMPRESSIBLE_REGEXP =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;

const ENCODING_NAMES = ["br", "gzip", "deflate", "zstd"] as const;

export const compress = ({
	threshold = 1024,
}: CompressOptions = FreezeEmpty) => {
	return module().middleware(async ({ request: { raw }, response }, next) => {
		await next();

		const contentLength = response.headers.get("content-length");

		if (
			!response.content ||
			raw.method === "HEAD" ||
			(response.headers.get("cache-control") ?? "").indexOf(
				"no-transform",
			) !== -1 ||
			raw.headers.has("range") ||
			response.headers.has("content-encoding") ||
			response.headers.has("content-range") ||
			response.headers.has("transfer-encoding") ||
			(contentLength && Number(contentLength) < threshold)
		) {
			return;
		}

		const encodingName = selectHeader(
			raw.headers.get("accept-encoding") ?? "",
			ENCODING_NAMES,
		);

		if (!encodingName) {
			return;
		}

		const processedResponse = processResponse(response);

		const contentType = processedResponse.headers.get("content-type");

		if (!contentType || !COMPRESSIBLE_REGEXP.test(contentType)) {
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

		const vary = processedResponse.headers.get("vary");

		if (!vary || vary.toLowerCase().indexOf("accept-encoding") === -1) {
			processedResponse.headers.append("vary", "Accept-Encoding");
		}

		processedResponse.headers.delete("content-length");

		processedResponse.headers.set("content-encoding", encodingName);

		response.content = success(
			new Response(
				stream.pipeThrough(
					new CompressionStream(
						// @ts-expect-error
						encodingName === "br" ? "brotli" : encodingName,
					),
				),
				processedResponse,
			),
			{
				status: processedResponse.status,
				transform: false,
			},
		);
	});
};
