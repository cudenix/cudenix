import { module } from "@/core/module";
import { processResponse } from "@/core/response";
import { success } from "@/core/success";
import { selectHeader } from "@/utils/headers/select";
import { FreezeEmpty } from "@/utils/objects/empty";

const COMPRESSIBLE_REGEXP =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;

const ENCODING_NAMES = ["br", "gzip", "deflate", "zstd"] as const;

interface CompressOptions {
	threshold?: number;
}

export const compress = ({
	threshold = 1024,
}: CompressOptions = FreezeEmpty) => {
	return module().middleware(async ({ request: { raw }, response }, next) => {
		await next();

		if (
			!response.content ||
			raw.method === "HEAD" ||
			+(response.headers.get("content-length") ?? "") < threshold ||
			response.headers.has("content-encoding") ||
			response.headers.has("content-range") ||
			response.headers.has("transfer-encoding") ||
			raw.headers.has("range") ||
			(response.headers.get("cache-control") ?? "").indexOf(
				"no-transform",
			) !== -1
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

		const processedHeaders = processedResponse.headers;
		const contentType = processedHeaders.get("content-type");

		if (!contentType || !COMPRESSIBLE_REGEXP.test(contentType)) {
			return;
		}

		let stream = processedResponse.body;

		if (!stream) {
			const buffer = await processedResponse.arrayBuffer();

			if (buffer.byteLength < threshold) {
				return;
			}

			stream = new Blob([buffer]).stream();
		}

		if (!stream) {
			return;
		}

		processedHeaders.delete("content-length");

		const vary = processedHeaders.get("vary");

		if (!vary || vary.toLowerCase().indexOf("accept-encoding") === -1) {
			processedHeaders.append("vary", "Accept-Encoding");
		}

		processedHeaders.set("content-encoding", encodingName);

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
