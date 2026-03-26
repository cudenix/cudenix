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

const ENCODING_INDEX = {
	br: 0,
	deflate: 2,
	gzip: 1,
	zstd: 3,
} as const satisfies Record<(typeof ENCODING_NAMES)[number], number>;

const parseQuality = (entry: string, semiIdx: number): number => {
	const params = entry.slice(semiIdx + 1).split(";");

	for (let i = 0; i < params.length; i++) {
		const param = params[i]?.trim();

		if (!param) {
			continue;
		}

		if (
			param.length > 2 &&
			param.charCodeAt(0) === 0x71 &&
			param.charCodeAt(1) === 0x3d
		) {
			const q = Number(param.slice(2));

			if (!Number.isNaN(q)) {
				return q;
			}
		}
	}

	return 1;
};

const selectEncoding = (header: string) => {
	if (!header) {
		return;
	}

	let bestIdx = -1;
	let bestQ = -1;
	let bestOrder = Infinity;

	let starQ = -1;
	let starOrder = Infinity;
	let hasStar = false;

	let mentioned = 0;

	const entries = header.split(",");

	for (let order = 0; order < entries.length; order++) {
		const entry = entries[order]?.trim();

		if (!entry) {
			continue;
		}

		const semiIdx = entry.indexOf(";");
		const name = (semiIdx === -1 ? entry : entry.slice(0, semiIdx))
			.trim()
			.toLowerCase();

		if (!name) {
			continue;
		}

		const q = semiIdx === -1 ? 1 : parseQuality(entry, semiIdx);

		if (name === "*") {
			if (!hasStar || q > starQ) {
				starQ = q;
				starOrder = order;
				hasStar = true;
			}

			continue;
		}

		const idx = ENCODING_INDEX[name as keyof typeof ENCODING_INDEX];

		if (idx === undefined) {
			continue;
		}

		mentioned |= 1 << idx;

		if (q > 0 && (q > bestQ || (q === bestQ && order < bestOrder))) {
			bestIdx = idx;
			bestQ = q;
			bestOrder = order;
		}
	}

	if (hasStar && starQ > 0) {
		for (let i = 0; i < ENCODING_NAMES.length; i++) {
			if (!(mentioned & (1 << i))) {
				if (
					starQ > bestQ ||
					(starQ === bestQ && starOrder < bestOrder)
				) {
					return ENCODING_NAMES[i];
				}

				break;
			}
		}
	}

	return bestIdx >= 0 ? ENCODING_NAMES[bestIdx] : undefined;
};

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

		const encodingName = selectEncoding(
			raw.headers.get("accept-encoding") ?? "",
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
