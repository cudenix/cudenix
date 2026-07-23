import { Empty } from "@/utils/objects/empty";

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

	const firstCharCode = contentType.charCodeAt(0);

	let isForm = false;

	// "a" (97) application/*
	if (firstCharCode === 97) {
		const length = contentType.length;

		// the media type matches exactly or is followed by ";" (59) and parameters
		if (
			(length === 16 || contentType.charCodeAt(16) === 59) &&
			contentType.startsWith("application/json")
		) {
			return request.json() as Promise<unknown>;
		}

		// ";" (59) starts media type parameters
		if (
			(length === 24 || contentType.charCodeAt(24) === 59) &&
			contentType.startsWith("application/octet-stream")
		) {
			return request.arrayBuffer();
		}

		// ";" (59) starts media type parameters
		isForm =
			(length === 33 || contentType.charCodeAt(33) === 59) &&
			contentType.startsWith("application/x-www-form-urlencoded");
	} else if (
		// "m" (109) multipart/*
		firstCharCode === 109
	) {
		const length = contentType.length;

		// ";" (59) starts media type parameters
		isForm =
			(length === 19 || contentType.charCodeAt(19) === 59) &&
			contentType.startsWith("multipart/form-data");
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
