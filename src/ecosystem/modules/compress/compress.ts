import { module } from "@/core/module";
import { processResponse } from "@/core/response";
import { success } from "@/core/success";
import { FreezeEmpty } from "@/utils/objects/empty";

export interface CompressOptions {
	threshold?: number;
}

const COMPRESSIBLE_REGEXP =
	/^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;

const ENCODING_NAMES = ["br", "gzip", "deflate", "zstd"] as const;

const selectEncoding = (header: string) => {
	if (!header) {
		return;
	}

	const length = header.length;

	let bestName: string | undefined;
	let bestQ = -1;
	let bestOrder = 0x7fffffff;

	let starQ = -1;
	let starOrder = 0x7fffffff;
	let hasStar = false;

	let order = 0;
	let start = 0;

	while (start < length) {
		let end = header.indexOf(",", start);

		if (end === -1) {
			end = length;
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
				const nameLength = nameEnd - tokenStart;

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

				if (nameLength === 1 && header.charCodeAt(tokenStart) === 42) {
					if (!hasStar || q > starQ) {
						starQ = q;
						starOrder = order;
						hasStar = true;
					}
				} else if (q > 0) {
					let matched: number | undefined;

					if (nameLength === 2) {
						const c0 = header.charCodeAt(tokenStart) | 0x20;
						const c1 = header.charCodeAt(tokenStart + 1) | 0x20;

						if (c0 === 98 && c1 === 114) {
							matched = 0;
						}
					} else if (nameLength === 4) {
						const c0 = header.charCodeAt(tokenStart) | 0x20;
						const c1 = header.charCodeAt(tokenStart + 1) | 0x20;
						const c2 = header.charCodeAt(tokenStart + 2) | 0x20;
						const c3 = header.charCodeAt(tokenStart + 3) | 0x20;

						if (
							c0 === 103 &&
							c1 === 122 &&
							c2 === 105 &&
							c3 === 112
						) {
							matched = 1;
						} else if (
							c0 === 122 &&
							c1 === 115 &&
							c2 === 116 &&
							c3 === 100
						) {
							matched = 3;
						}
					} else if (nameLength === 7) {
						const c0 = header.charCodeAt(tokenStart) | 0x20;
						const c1 = header.charCodeAt(tokenStart + 1) | 0x20;
						const c2 = header.charCodeAt(tokenStart + 2) | 0x20;
						const c3 = header.charCodeAt(tokenStart + 3) | 0x20;
						const c4 = header.charCodeAt(tokenStart + 4) | 0x20;
						const c5 = header.charCodeAt(tokenStart + 5) | 0x20;
						const c6 = header.charCodeAt(tokenStart + 6) | 0x20;

						if (
							c0 === 100 &&
							c1 === 101 &&
							c2 === 102 &&
							c3 === 108 &&
							c4 === 97 &&
							c5 === 116 &&
							c6 === 101
						) {
							matched = 2;
						}
					}

					if (
						matched !== undefined &&
						(q > bestQ || (q === bestQ && order < bestOrder))
					) {
						bestName = ENCODING_NAMES[matched];
						bestQ = q;
						bestOrder = order;
					}
				}

				order++;
			}
		}

		start = end + 1;
	}

	if (
		hasStar &&
		starQ > 0 &&
		(bestQ < starQ || (bestQ === starQ && starOrder < bestOrder))
	) {
		return ENCODING_NAMES[0];
	}

	if (!bestName && hasStar && starQ > 0) {
		return ENCODING_NAMES[0];
	}

	return bestName;
};

export const compress = ({
	threshold = 1024,
}: CompressOptions = FreezeEmpty) => {
	return module().middleware(async ({ request: { raw }, response }, next) => {
		await next();

		const contentLength = response.headers.get("Content-Length");

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

		const encodingName = selectEncoding(
			raw.headers.get("Accept-Encoding") ?? "",
		);

		if (!encodingName) {
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
