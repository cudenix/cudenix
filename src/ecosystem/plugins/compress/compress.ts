import { Module } from "@/core/module";
import { ok } from "@/core/reply";
import { response } from "@/core/response";
import { selectHeader } from "@/utils/headers/select-header";
import { FrozenEmpty } from "@/utils/objects/empty";
import { peek, peekStatus } from "@/utils/promises/peek";

const COMPRESSIBLE_REGEXP =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;

const ENCODING_NAMES = ["br", "gzip", "deflate", "zstd"] as const;

// matches the Vary token without allocating a lowercase copy
const ACCEPT_ENCODING = /accept-encoding/i;

const COMPRESSION_ALGORITHM = {
	br: "brotli",
	deflate: "deflate",
	gzip: "gzip",
	zstd: "zstd",
} as const;

interface CompressOptions {
	threshold?: number;
}

export const compress = ({ threshold = 1024 }: CompressOptions = FrozenEmpty) =>
	// a plain parameter lets the analyzer narrow the context this middleware needs
	new Module().middleware(async (context, next) => {
		const returned = next();

		// a chain that never suspends settles before it is read
		if (peekStatus(returned) !== "fulfilled") {
			await returned;
		}

		const content = context.response.content;
		const raw = context.request.raw;

		if (
			!content ||
			raw.method === "HEAD" ||
			content instanceof ReadableStream
		) {
			return;
		}

		const responseHeaders = context.response.headers;

		if (
			responseHeaders.has("content-encoding") ||
			responseHeaders.has("content-range") ||
			responseHeaders.has("transfer-encoding") ||
			raw.headers.has("range")
		) {
			return;
		}

		const contentLength = responseHeaders.get("content-length");

		if (contentLength && Number(contentLength) < threshold) {
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

		// without cookies or headers this is exactly the content materialization
		const processedResponse = response(content);

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
			const read = processedResponse.arrayBuffer();
			// a buffered body settles before it is read
			const buffer =
				peekStatus(read) === "fulfilled" ? peek(read) : await read;

			if (buffer.byteLength < threshold) {
				return;
			}

			if (encodingName === "gzip") {
				compressed = Bun.gzipSync(buffer);
			} else if (encodingName === "zstd") {
				compressed = Bun.zstdCompressSync(
					buffer,
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

		if (!vary || !ACCEPT_ENCODING.test(vary)) {
			processedHeaders.append("vary", "Accept-Encoding");
		}

		processedHeaders.set("content-encoding", encodingName);

		context.response.content = ok(
			new Response(compressed, processedResponse),
			{ status: processedResponse.status },
		);
	});
