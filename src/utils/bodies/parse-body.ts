import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Parse the body of a request into a value chosen by its `Content-Type`.
 */

/**
 * Read and parse the body of a `Request`, dispatching on its `Content-Type`
 * header. Use it on the request hot path to materialize the body without
 * branching on the content type by hand at every call site.
 *
 * - No `Content-Type` header maps to text (a string).
 * - `application/json` is run through `Request.json` (any JSON value).
 * - `application/octet-stream` is read as an `ArrayBuffer`.
 * - `application/x-www-form-urlencoded` and `multipart/form-data` are read as
 *   form data into a dictionary keyed by field name; a repeated field collapses
 *   into an array in first-seen order, and a `multipart/form-data` file field
 *   keeps its `File` value.
 * - Any other content type maps to text (a string).
 * - A trailing parameter (e.g. `application/json; charset=utf-8`) still matches;
 *   a longer look-alike (e.g. `application/json5`) does not.
 * - Matching is case-sensitive — only lowercase media types are recognized, so
 *   `APPLICATION/JSON` falls back to text.
 * - The form dictionary is prototype-free (built on {@link Empty}), so field
 *   names like `__proto__` are safe to read.
 *
 * @param request - Request whose body should be consumed and parsed.
 * @returns A promise resolving to the parsed body: a string, a parsed JSON
 *   value, an `ArrayBuffer`, or a form-field dictionary.
 * @example
 * ```typescript
 * const a = new Request("https://a.b/c", {
 * 	body: JSON.stringify({ b: "v1" }),
 * 	headers: { "content-type": "application/json" },
 * 	method: "POST",
 * });
 *
 * await parseBody(a); // { b: "v1" }
 *
 * const c = new Request("https://a.b/c", { body: "v1", method: "POST" });
 *
 * await parseBody(c); // "v1"
 * ```
 */
export const parseBody = async (request: Request) => {
	const contentType = request.headers.get("content-type");

	if (!contentType) {
		return request.text();
	}

	const first = contentType.charCodeAt(0);

	let isForm = false;

	if (first === 97) {
		const length = contentType.length;

		if (
			(length === 16 || contentType.charCodeAt(16) === 59) &&
			contentType.startsWith("application/json")
		) {
			return request.json() as Promise<unknown>;
		}

		if (
			(length === 24 || contentType.charCodeAt(24) === 59) &&
			contentType.startsWith("application/octet-stream")
		) {
			return request.arrayBuffer();
		}

		isForm =
			(length === 33 || contentType.charCodeAt(33) === 59) &&
			contentType.startsWith("application/x-www-form-urlencoded");
	} else if (first === 109) {
		const length = contentType.length;

		isForm =
			(length === 19 || contentType.charCodeAt(19) === 59) &&
			contentType.startsWith("multipart/form-data");
	}

	if (isForm) {
		const formData = await request.formData();

		const body = new Empty();

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
