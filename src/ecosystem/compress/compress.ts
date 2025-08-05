import { brotliCompressSync, constants } from "node:zlib";
import type { ZlibCompressionOptions } from "bun";

import { CompressionStream } from "@/ecosystem/compress/compression-stream";
import { error } from "@/error";
import { module } from "@/module";
import { processResponse } from "@/response";
import { success } from "@/success";
import { Empty } from "@/utils/empty";

interface CompressOptions {
	threshold?: number;
	level?: ZlibCompressionOptions["level"];
}

export const compress = {
	module: ({ threshold = 512, level }: CompressOptions = new Empty()) => {
		const encodings = ["zstd", "br", "gzip", "deflate"] as const;

		return module().middleware(
			async ({ request: { raw }, response }, next) => {
				await next();

				if (
					!response.content ||
					raw.method === "HEAD" ||
					response.headers.has("Content-Encoding") ||
					response.headers.has("Transfer-Encoding")
				) {
					return;
				}

				const acceptEncoding = raw.headers.get("Accept-Encoding");

				if (!acceptEncoding || acceptEncoding.length === 0) {
					return;
				}

				const accepted = new Set(
					acceptEncoding
						.split(",")
						.map((encoding) => {
							return encoding.trim().toLowerCase().split(";")[0];
						})
						.filter((encoding): encoding is string => {
							return Boolean(encoding);
						}),
				);

				const encoding = encodings.find((encoding) => {
					return accepted.has(encoding);
				});

				if (!encoding) {
					return;
				}

				if (response.content instanceof ReadableStream) {
					const stream = new CompressionStream(encoding, {
						flush:
							encoding === "br"
								? constants.BROTLI_OPERATION_FLUSH
								: constants.Z_SYNC_FLUSH,
						level,
					});

					response.content = response.content.pipeThrough(stream);

					response.headers.set("Content-Encoding", encoding);

					response.headers.delete("Content-Length");

					return;
				}

				const processedResponse = await processResponse(response);

				const buffer = Buffer.from(
					await processedResponse.arrayBuffer(),
				);

				if (buffer.byteLength < threshold) {
					return;
				}

				let compressed: Buffer | Uint8Array | undefined;

				if (encoding === "zstd") {
					compressed = await Bun.zstdCompress(buffer, {
						level: level ?? 4,
					});
				} else if (encoding === "br") {
					compressed = brotliCompressSync(buffer, {
						params: {
							[constants.BROTLI_PARAM_QUALITY]: level ?? 11,
						},
					});
				} else if (encoding === "gzip") {
					compressed = Bun.gzipSync(buffer, {
						level: level ?? 6,
					});
				} else if (encoding === "deflate") {
					compressed = Bun.deflateSync(buffer, {
						level: level ?? 6,
					});
				}

				if (!compressed) {
					return;
				}

				response.headers.set("Content-Encoding", encoding);

				response.headers.set(
					"Content-Length",
					String(compressed.byteLength),
				);

				const contentType =
					processedResponse.headers.get("Content-Type");

				if (contentType) {
					response.headers.set("Content-Type", contentType);
				}

				response.content = response.content.success
					? success(compressed, response.content.status, false)
					: error(compressed, response.content.status, false);
			},
		);
	},
};
