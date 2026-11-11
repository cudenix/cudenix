const JSON_MEDIA_TYPE = /^application\/json[\t ]*(?:[,;]|$)/i;
const BINARY_MEDIA_TYPE = /^application\/octet-stream[\t ]*(?:[,;]|$)/i;
const URLENCODED_MEDIA_TYPE =
	/^application\/x-www-form-urlencoded[\t ]*(?:[,;]|$)/i;
const MULTIPART_MEDIA_TYPE = /^multipart\/form-data[\t ]*(?:[,;]|$)/i;
const PLUS = /\+/g;

/**
 * Stores a form entry, collapsing repeated keys into arrays.
 */
const addEntry = (
	body: Record<PropertyKey, unknown>,
	key: string,
	value: string,
): void => {
	const current = body[key];

	if (current === undefined) {
		body[key] = value;
	} else if (Array.isArray(current)) {
		current.push(value);
	} else {
		body[key] = [current, value];
	}
};

/**
 * Scans urlencoded text into a dictionary, throwing on a malformed escape.
 */
const scanUrlencoded = (text: string): Record<PropertyKey, unknown> => {
	const body = Object.create(null) as Record<PropertyKey, unknown>;
	const { length } = text;

	let i = 0;

	while (i < length) {
		const keyStart = i;

		let charCode = 0;
		let keyHasPlus = false;
		let keyHasPercent = false;

		while (i < length) {
			charCode = text.charCodeAt(i);

			// stop at "=" (61) or "&" (38)
			if (charCode === 61 || charCode === 38) {
				break;
			}

			// "+" (43) and "%" (37) require key decoding
			if (charCode === 43) {
				keyHasPlus = true;
			} else if (charCode === 37) {
				keyHasPercent = true;
			}

			i++;
		}

		let key = text.slice(keyStart, i);
		let value = "";

		// "=" (61) starts the value
		if (i < length && charCode === 61) {
			const valueStart = ++i;

			let valueHasPlus = false;
			let valueHasPercent = false;

			while (i < length) {
				charCode = text.charCodeAt(i);

				// stop at "&" (38)
				if (charCode === 38) {
					break;
				}

				// "+" (43) and "%" (37) require value decoding
				if (charCode === 43) {
					valueHasPlus = true;
				} else if (charCode === 37) {
					valueHasPercent = true;
				}

				i++;
			}

			value = text.slice(valueStart, i);

			if (valueHasPlus) {
				value = value.replaceAll(PLUS, " ");
			}

			if (valueHasPercent) {
				value = decodeURIComponent(value);
			}
		} else if (i === keyStart) {
			// skips an empty pair
			i++;

			continue;
		}

		if (keyHasPlus) {
			key = key.replaceAll(PLUS, " ");
		}

		if (keyHasPercent) {
			key = decodeURIComponent(key);
		}

		addEntry(body, key, value);

		i++;
	}

	return body;
};

/**
 * Parses urlencoded text into a dictionary.
 */
const parseUrlencoded = (text: string): Record<PropertyKey, unknown> => {
	try {
		return scanUrlencoded(text);
	} catch {
		const body = Object.create(null) as Record<PropertyKey, unknown>;

		// a doubled "?" keeps a leading one in the first key
		new URLSearchParams(
			text.charCodeAt(0) === 63 ? `?${text}` : text,
		).forEach((value, key) => {
			addEntry(body, key, value);
		});

		return body;
	}
};

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
export const parseBody = async (request: Request): Promise<unknown> => {
	const contentType = request.headers.get("content-type");

	if (contentType === null || contentType === "") {
		return request.text();
	}

	if (JSON_MEDIA_TYPE.test(contentType)) {
		return request.json() as Promise<unknown>;
	}

	if (BINARY_MEDIA_TYPE.test(contentType)) {
		return request.arrayBuffer();
	}

	if (URLENCODED_MEDIA_TYPE.test(contentType)) {
		return request.text().then(parseUrlencoded);
	}

	if (MULTIPART_MEDIA_TYPE.test(contentType)) {
		return parseFormBody(request);
	}

	return request.text();
};
