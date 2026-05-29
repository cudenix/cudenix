import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Parse the query string of a URL into a key/value dictionary.
 */

const Q_KEY_PLUS = 1;
const Q_KEY_PCT = 2;
const Q_VAL_PLUS = 4;
const Q_VAL_PCT = 8;

/**
 * Parse the query string of a URL into a dictionary keyed by parameter name.
 * Use it on the request hot path to read query parameters without allocating a
 * `URL` / `URLSearchParams` pair.
 *
 * - Everything up to and including the first `"?"` is skipped; a `"#"` fragment
 *   ends parsing.
 * - `"+"` becomes a space and `%xx` escapes are decoded in both keys and values.
 * - A value wrapped in `{...}` or `[...]` is run through `JSON.parse`; invalid
 *   JSON falls back to the raw string.
 * - A repeated key collapses into an array in first-seen order.
 * - A key with no `"="` maps to an empty string; entries with an empty key are
 *   skipped.
 * - Always returns a dictionary (never `undefined`); it is empty when the URL
 *   has no `"?"` or yields no usable parameters.
 * - Result is prototype-free (built on {@link Empty}), so names like `__proto__`
 *   are safe to read.
 *
 * @param url - Full URL (or path with query) to read the query string from.
 * @returns Dictionary mapping each parameter name to its parsed value; empty
 *   when there is nothing to parse.
 * @example
 * ```typescript
 * parseQuery("/a?b=v1&c=v2"); // { b: "v1", c: "v2" }
 * parseQuery("/a?b=v1&b=v2"); // { b: ["v1", "v2"] }
 * parseQuery('/a?b={"c":1}'); // { b: { c: 1 } }
 * parseQuery("/a"); // {}
 * ```
 */
export const parseQuery = (url: string) => {
	const params = new Empty();
	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return params;
	}

	const urlLength = url.length;

	let i = queryIndex + 1;

	while (i < urlLength) {
		const keyStart = i;

		let flags = 0;

		while (i < urlLength) {
			const char = url.charCodeAt(i);

			if (char === 61 || char === 38 || char === 35) {
				break;
			}

			if (char === 43) {
				flags |= Q_KEY_PLUS;
			} else if (char === 37) {
				flags |= Q_KEY_PCT;
			}

			i++;
		}

		const hasValue = i < urlLength && url.charCodeAt(i) === 61;

		let key = url.substring(keyStart, i);
		let value: string;

		if (hasValue) {
			i++;

			const valueStart = i;

			while (i < urlLength) {
				const char = url.charCodeAt(i);

				if (char === 38 || char === 35) {
					break;
				}

				if (char === 43) {
					flags |= Q_VAL_PLUS;
				} else if (char === 37) {
					flags |= Q_VAL_PCT;
				}

				i++;
			}

			value = url.substring(valueStart, i);
		} else {
			value = "";
		}

		if (key.length > 0) {
			if (flags & Q_KEY_PLUS) {
				key = key.replaceAll("+", " ");
			}

			if (flags & Q_KEY_PCT) {
				key = decodeURIComponent(key);
			}

			if (hasValue) {
				if (flags & Q_VAL_PLUS) {
					value = value.replaceAll("+", " ");
				}

				if (flags & Q_VAL_PCT) {
					value = decodeURIComponent(value);
				}
			}

			const firstChar = value.charCodeAt(0);

			let parsed = value as unknown;

			if (firstChar === 123 || firstChar === 91) {
				const lastChar = value.charCodeAt(value.length - 1);

				if (
					(firstChar === 123 && lastChar === 125) ||
					(firstChar === 91 && lastChar === 93)
				) {
					try {
						parsed = JSON.parse(value);
					} catch {
						parsed = value;
					}
				}
			}

			if (params[key] === undefined) {
				params[key] = parsed;
			} else if (Array.isArray(params[key])) {
				(params[key] as unknown[]).push(parsed);
			} else {
				params[key] = [params[key], parsed];
			}
		}

		if (i >= urlLength || url.charCodeAt(i) === 35) {
			break;
		}

		i++;
	}

	return params;
};
