// ASCII case-insensitive media types, ending at ";", "," or the end
const JSON_MEDIA_TYPE = /^application\/json[\t ]*(?:[,;]|$)/i;
const BINARY_MEDIA_TYPE = /^application\/octet-stream[\t ]*(?:[,;]|$)/i;
const URLENCODED_MEDIA_TYPE =
	/^application\/x-www-form-urlencoded[\t ]*(?:[,;]|$)/i;
const MULTIPART_MEDIA_TYPE = /^multipart\/form-data[\t ]*(?:[,;]|$)/i;

/**
 * Reads a form body into a dictionary.
 */
const parseFormBody = async (
	request: Request,
): Promise<Record<PropertyKey, unknown>> => {
	const formData = await request.formData();

	const body = Object.create(null) as Record<PropertyKey, unknown>;

	// repeated form keys collapse into arrays
	formData.forEach((value, key) => {
		if (body[key] === undefined) {
			body[key] = value;

			return;
		}

		if (Array.isArray(body[key])) {
			body[key].push(value);

			return;
		}

		body[key] = [body[key], value];
	});

	return body;
};

/**
 * Parses a request body according to its content type.
 *
 * @example
 * ```typescript
 * const request = new Request("https://a.b/c", {
 *   body: JSON.stringify({ b: "v1" }),
 *   headers: { "content-type": "application/json" },
 *   method: "POST",
 * });
 *
 * await parseBody(request); // { b: "v1" }
 * ```
 */
export const parseBody = (request: Request): Promise<unknown> => {
	const contentType = request.headers.get("content-type");

	if (!contentType) {
		return request.text();
	}

	if (JSON_MEDIA_TYPE.test(contentType)) {
		return request.json() as Promise<unknown>;
	}

	if (BINARY_MEDIA_TYPE.test(contentType)) {
		return request.arrayBuffer();
	}

	if (
		URLENCODED_MEDIA_TYPE.test(contentType) ||
		MULTIPART_MEDIA_TYPE.test(contentType)
	) {
		return parseFormBody(request);
	}

	return request.text();
};
