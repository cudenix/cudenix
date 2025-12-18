import { module, processResponse, success } from "@/core";
import { Empty } from "@/utils";

export interface CompressOptions {
	threshold?: number;
}

const compressibleRegexp =
	/^\s*(?:text\/[^;\s]+|application\/(?:json|javascript|xml|x-www-form-urlencoded)|[^;\s]+\/[^;\s]+\+(?:json|text|xml|yaml))(?:[;\s]|$)/i;
const noTransformRegexp = /\bno-transform\b/i;

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

	let order = 0;

	const split = header.split(",");

	for (let i = 0; i < split.length; i++) {
		const token = split[i]?.trim().toLowerCase();

		if (!token) {
			continue;
		}

		const [name, ...options] = token.split(";").map((split) => {
			return split.trim();
		});

		if (!name) {
			continue;
		}

		let q = 1;

		for (let j = 0; j < options.length; j++) {
			const option = options[j];

			if (!option) {
				continue;
			}

			const priority = Number(option.match(/^q=([0-9.]+)$/)?.[1]);

			if (Number.isNaN(priority)) {
				continue;
			}

			q = priority;
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

	return map;
};

export const compress = (
	{ threshold = 1024 }: CompressOptions = new Empty(),
) => {
	const encodings = ["br", "gzip", "deflate", "zstd"] as const;

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

		const accepted = parseAcceptEncoding(
			raw.headers.get("Accept-Encoding") ?? "",
		);

		if (accepted.size === 0) {
			return;
		}

		const star = accepted.get("*");

		const encoding = encodings
			.map((encoding) => {
				return {
					order: 0,
					q: 0,
					...(accepted.get(encoding) ?? star),
					name: encoding,
				};
			})
			.filter((encoding) => {
				return encoding.q > 0;
			})
			.sort((a, b) => {
				return b.q === a.q ? a.order - b.order : b.q - a.q;
			})[0];

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
