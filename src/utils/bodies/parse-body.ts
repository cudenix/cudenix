const JSON_MEDIA_TYPE = /^application\/json[\t ]*(?:[,;]|$)/i;
const BINARY_MEDIA_TYPE = /^application\/octet-stream[\t ]*(?:[,;]|$)/i;
const URLENCODED_MEDIA_TYPE =
	/^application\/x-www-form-urlencoded[\t ]*(?:[,;]|$)/i;
const MULTIPART_MEDIA_TYPE = /^multipart\/form-data[\t ]*(?:[,;]|$)/i;
const PLUS = /\+/g;

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

const scanUrlencoded = (text: string): Record<PropertyKey, unknown> => {
	const { length } = text;

	const body = Object.create(null) as Record<PropertyKey, unknown>;

	let i = 0;

	while (i < length) {
		const keyStart = i;

		let charCode = 0;
		let keyHasPlus = false;
		let keyHasPercent = false;

		while (i < length) {
			charCode = text.charCodeAt(i);

			if (charCode === 61 || charCode === 38) {
				break;
			}

			if (charCode === 43) {
				keyHasPlus = true;
			} else if (charCode === 37) {
				keyHasPercent = true;
			}

			i++;
		}

		let key = text.slice(keyStart, i);
		let value = "";

		if (i < length && charCode === 61) {
			const valueStart = ++i;

			let valueHasPlus = false;
			let valueHasPercent = false;

			while (i < length) {
				charCode = text.charCodeAt(i);

				if (charCode === 38) {
					break;
				}

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

const parseFormBody = async (
	request: Request,
): Promise<Record<PropertyKey, unknown>> => {
	const formData = await request.formData();

	const body = Object.create(null) as Record<PropertyKey, unknown>;

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
