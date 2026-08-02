import { Empty } from "@/utils/objects/empty";

/**
 * Compares a media type region against a lowercase name, ignoring case.
 */
const matchesMediaType = (
	contentType: string,
	end: number,
	mediaType: string,
) => {
	if (end !== mediaType.length) {
		return false;
	}

	for (let i = 0; i < end; i++) {
		// "| 32" lowercases letters
		if ((contentType.charCodeAt(i) | 32) !== mediaType.charCodeAt(i)) {
			return false;
		}
	}

	return true;
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
export const parseBody = async (request: Request) => {
	const contentType = request.headers.get("content-type");

	if (!contentType) {
		return request.text();
	}

	// ";" (59) starts the media type parameters
	let mediaTypeEnd = contentType.indexOf(";");

	if (mediaTypeEnd === -1) {
		mediaTypeEnd = contentType.length;
	}

	// trim trailing " " (32) and "\t" (9)
	while (mediaTypeEnd > 0) {
		const charCode = contentType.charCodeAt(mediaTypeEnd - 1);

		if (charCode !== 32 && charCode !== 9) {
			break;
		}

		mediaTypeEnd--;
	}

	// "| 32" lowercases
	const firstCharCode = contentType.charCodeAt(0) | 32;

	let isForm = false;

	// "a" (97) application/*
	if (firstCharCode === 97) {
		if (matchesMediaType(contentType, mediaTypeEnd, "application/json")) {
			return request.json() as Promise<unknown>;
		}

		if (
			matchesMediaType(
				contentType,
				mediaTypeEnd,
				"application/octet-stream",
			)
		) {
			return request.arrayBuffer();
		}

		if (
			matchesMediaType(
				contentType,
				mediaTypeEnd,
				"application/x-www-form-urlencoded",
			)
		) {
			isForm = true;
		}
	} else if (
		// "m" (109) multipart/*
		firstCharCode === 109
	) {
		if (
			matchesMediaType(contentType, mediaTypeEnd, "multipart/form-data")
		) {
			isForm = true;
		}
	}

	if (isForm) {
		const formData = await request.formData();

		const body = new Empty();

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
	}

	return request.text();
};
