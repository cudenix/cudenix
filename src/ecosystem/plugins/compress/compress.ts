import { module } from "@/core/module";
import { processResponse } from "@/core/response";
import { success } from "@/core/success";
import { selectHeader } from "@/utils/headers/select-header";
import { FreezeEmpty } from "@/utils/objects/empty";

const COMPRESSIBLE_REGEXP =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;

const ENCODING_NAMES = ["br", "gzip", "deflate", "zstd"] as const;

const COMPRESSION_ALGORITHM = {
	br: "brotli",
	deflate: "deflate",
	gzip: "gzip",
	zstd: "zstd",
} as const;

interface CompressOptions {
	threshold?: number;
}

export const compress = ({ threshold = 1024 }: CompressOptions = FreezeEmpty) => module().middleware(async ({ request: { raw }, response }, next) => {
		await next();

		if (!response.content || raw.method === "HEAD") {
			return;
		}

		const responseHeaders = response.headers;

		if (
			responseHeaders.has("content-encoding") ||
			responseHeaders.has("content-range") ||
			responseHeaders.has("transfer-encoding") ||
			raw.headers.has("range")
		) {
			return;
		}

		const contentLength = responseHeaders.get("content-length");

		if (contentLength && +contentLength < threshold) {
			return;
		}

		const cacheControl = responseHeaders.get("cache-control");

		if (cacheControl && cacheControl.indexOf("no-transform") !== -1) {
			return;
		}

		const acceptEncoding = raw.headers.get("accept-encoding");

		if (!acceptEncoding) {
			return;
		}

		const encodingName = selectHeader(acceptEncoding, ENCODING_NAMES);

		if (!encodingName) {
			return;
		}

		const processedResponse = processResponse(response);

		const processedHeaders = processedResponse.headers;
		const contentType = processedHeaders.get("content-type");

		if (!contentType || !COMPRESSIBLE_REGEXP.test(contentType)) {
			return;
		}

		const body = processedResponse.body;

		let compressed: BodyInit;

		if (body) {
			compressed = body.pipeThrough(
				// @ts-expect-error
				new CompressionStream(COMPRESSION_ALGORITHM[encodingName]),
			);
		} else {
			const buffer = await processedResponse.arrayBuffer();

			if (buffer.byteLength < threshold) {
				return;
			}

			if (encodingName === "gzip") {
				compressed = Bun.gzipSync(new Uint8Array(buffer));
			} else if (encodingName === "zstd") {
				compressed = Bun.zstdCompressSync(
					new Uint8Array(buffer),
				) as Uint8Array<ArrayBuffer>;
			} else {
				compressed = new Blob([buffer]).stream().pipeThrough(
					// @ts-expect-error
					new CompressionStream(COMPRESSION_ALGORITHM[encodingName]),
				);
			}
		}

		processedHeaders.delete("content-length");

		const vary = processedHeaders.get("vary");

		if (!vary || vary.toLowerCase().indexOf("accept-encoding") === -1) {
			processedHeaders.append("vary", "Accept-Encoding");
		}

		processedHeaders.set("content-encoding", encodingName);

		response.content = success(new Response(compressed, processedResponse), {
			status: processedResponse.status,
			transform: false,
		});
	});
