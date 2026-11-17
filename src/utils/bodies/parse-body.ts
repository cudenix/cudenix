import { parseUrlencoded } from "@/utils/urls/parse-urlencoded";

const BINARY_MEDIA_TYPE = /^application\/octet-stream[\t ]*(?:[,;]|$)/i;
const JSON_MEDIA_TYPE = /^application\/json[\t ]*(?:[,;]|$)/i;
const MULTIPART_MEDIA_TYPE = /^multipart\/form-data[\t ]*(?:[,;]|$)/i;
const URLENCODED_MEDIA_TYPE =
	/^application\/x-www-form-urlencoded[\t ]*(?:[,;]|$)/i;

const parseFormBody = async (
	request: Request,
): Promise<Record<PropertyKey, unknown>> => {
	const formData = await request.formData();

	const body: Record<string, unknown> = {};

	// oxlint-disable-next-line unicorn/no-array-for-each -- Using forEach to iterate over FormData entries is acceptable here
	formData.forEach((value, key) => {
		const current = body[key];

		if (current === undefined) {
			body[key] = value;
		} else if (Array.isArray(current)) {
			current.push(value);
		} else {
			body[key] = [current, value];
		}
	});

	return body;
};

const parseUrlencodedBody = (text: string): Record<string, unknown> =>
	parseUrlencoded(text, 0, text.length, false);

export const parseBody = async (request: Request): Promise<unknown> => {
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
		return parseFormBody(request);
	}

	return request.text();
};
