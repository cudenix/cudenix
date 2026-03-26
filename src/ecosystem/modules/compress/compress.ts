import { module } from "@/core/module";
import { processResponse } from "@/core/response";
import { success } from "@/core/success";
import { FreezeEmpty } from "@/utils/objects/empty";

export interface CompressOptions {
	threshold?: number;
}

const COMPRESSIBLE_REGEXP =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;
const NO_TRANSFORM_REGEXP = /\bno-transform\b/i;

const parseAcceptEncoding = (header: string) => {
	const map = new Map<
		string,
		{
			q: number;
			order: number;
		}
	>();

	if (!header) {
		return map;
	}

	const len = header.length;

	let order = 0;
	let start = 0;

	while (start < len) {
		let end = header.indexOf(",", start);

		if (end === -1) {
			end = len;
		}

		let tokenStart = start;
		let tokenEnd = end;

		while (tokenStart < tokenEnd && header.charCodeAt(tokenStart) <= 32) {
			tokenStart++;
		}

		while (tokenEnd > tokenStart && header.charCodeAt(tokenEnd - 1) <= 32) {
			tokenEnd--;
		}

		if (tokenStart < tokenEnd) {
			const semiIdx = header.indexOf(";", tokenStart);

			let nameEnd: number;

			if (semiIdx === -1 || semiIdx >= tokenEnd) {
				nameEnd = tokenEnd;
			} else {
				nameEnd = semiIdx;
			}

			while (
				nameEnd > tokenStart &&
				header.charCodeAt(nameEnd - 1) <= 32
			) {
				nameEnd--;
			}

			if (nameEnd > tokenStart) {
				let name = "";

				for (let k = tokenStart; k < nameEnd; k++) {
					const char = header.charCodeAt(k);

					name +=
						char >= 65 && char <= 90
							? String.fromCharCode(char + 32)
							: header[k];
				}

				let q = 1;

				if (semiIdx !== -1 && semiIdx < tokenEnd) {
					let optStart = semiIdx + 1;

					while (optStart < tokenEnd) {
						let optEnd = header.indexOf(";", optStart);

						if (optEnd === -1 || optEnd > tokenEnd) {
							optEnd = tokenEnd;
						}

						while (
							optStart < optEnd &&
							header.charCodeAt(optStart) <= 32
						) {
							optStart++;
						}

						while (
							optEnd > optStart &&
							header.charCodeAt(optEnd - 1) <= 32
						) {
							optEnd--;
						}

						if (
							optEnd - optStart > 2 &&
							header.charCodeAt(optStart) === 113 &&
							header.charCodeAt(optStart + 1) === 61
						) {
							const priority = +header.slice(
								optStart + 2,
								optEnd,
							);

							if (!Number.isNaN(priority)) {
								q = priority;
							}
						}

						optStart = optEnd + 1;
					}
				}

				const previous = map.get(name);

				if (!previous || q > previous.q) {
					map.set(name, {
						order,
						q,
					});
				}

				order++;
			}
		}

		start = end + 1;
	}

	return map;
};

export const compress = ({
	threshold = 1024,
}: CompressOptions = FreezeEmpty) => {
	const encodings = ["br", "gzip", "deflate", "zstd"] as const;

	return module().middleware(async ({ request: { raw }, response }, next) => {
		await next();

		const contentLength = response.headers.get("Content-Length");

		if (
			!response.content ||
			raw.method === "HEAD" ||
			NO_TRANSFORM_REGEXP.test(
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

		const accepted = parseAcceptEncoding(
			raw.headers.get("Accept-Encoding") ?? "",
		);

		if (accepted.size === 0) {
			return;
		}

		const star = accepted.get("*");

		let encoding: { name: string; q: number; order: number } | undefined;

		for (let i = 0; i < encodings.length; i++) {
			const name = encodings[i]!;
			const entry = accepted.get(name) ?? star;

			if (!entry || entry.q <= 0) {
				continue;
			}

			if (
				!encoding ||
				entry.q > encoding.q ||
				(entry.q === encoding.q && entry.order < encoding.order)
			) {
				encoding = { name, order: entry.order, q: entry.q };
			}
		}

		if (!encoding) {
			return;
		}

		const processedResponse = processResponse(response);

		const contentType = processedResponse.headers.get("Content-Type");

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

		const vary = processedResponse.headers.get("Vary");

		if (!vary || vary.toLowerCase().indexOf("accept-encoding") === -1) {
			processedResponse.headers.append("Vary", "Accept-Encoding");
		}

		processedResponse.headers.delete("Content-Length");

		processedResponse.headers.set("Content-Encoding", encoding.name);

		response.content = success(
			new Response(
				stream.pipeThrough(
					new CompressionStream(
						// @ts-expect-error
						encoding.name === "br" ? "brotli" : encoding.name,
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
