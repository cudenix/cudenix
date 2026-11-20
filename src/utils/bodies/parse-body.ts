import { parseUrlencoded } from "@/utils/urls/parse-urlencoded";

const BINARY_MEDIA_TYPE = /^application\/octet-stream[\t ]*(?:[,;]|$)/i;
const JSON_MEDIA_TYPE = /^application\/json[\t ]*(?:[,;]|$)/i;
const MULTIPART_MEDIA_TYPE = /^multipart\/form-data[\t ]*(?:[,;]|$)/i;
const URLENCODED_MEDIA_TYPE =
	/^application\/x-www-form-urlencoded[\t ]*(?:[,;]|$)/i;

const formDataToJSON = (formData: object): Record<string, unknown> =>
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- bun-types does not declare FormData.prototype.toJSON
	(formData as { toJSON(): Record<string, unknown> }).toJSON();

const parseUrlencodedBody = (text: string): Record<string, unknown> =>
	parseUrlencoded(text, 0, text.length, false);

// oxlint-disable-next-line typescript/promise-function-async -- The function returns a promise without being async to avoid extra ticks per request
export const parseBody = (request: Request): Promise<unknown> => {
	const contentType = request.headers.get("content-type");

	if (contentType === null || contentType === "") {
		return request.text();
	}

	if (JSON_MEDIA_TYPE.test(contentType)) {
		return request.json();
	}

	if (BINARY_MEDIA_TYPE.test(contentType)) {
		return request.arrayBuffer();
	}

	if (URLENCODED_MEDIA_TYPE.test(contentType)) {
		return request.text().then(parseUrlencodedBody);
	}

	if (MULTIPART_MEDIA_TYPE.test(contentType)) {
		return request.formData().then(formDataToJSON);
	}

	return request.text();
};
