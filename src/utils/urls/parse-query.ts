import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Parse the query string of a URL into a parameter name/value dictionary.
 */

const Q_KEY_PLUS = 1;
const Q_KEY_PCT = 2;
const Q_VAL_PLUS = 4;
const Q_VAL_PCT = 8;

/**
 * Parse a URL's query string into a parameter name/value
 * dictionary; empty when there is no query string.
 *
 * @example
 * ```typescript
 * parseQuery("/a?b=v1&c=v2"); // { b: "v1", c: "v2" }
 * parseQuery("/a?b=v1&b=v2"); // { b: ["v1", "v2"] }
 * parseQuery('/a?b={"c":1}'); // { b: { c: 1 } }
 * ```
 */
export const parseQuery = (url: string) => {
	const params = new Empty() as Record<string, unknown>;

	if (!url) {
		return params;
	}

	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return params;
	}

	const multiValue = new Set<string>();
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
				try {
					key = decodeURIComponent(key);
				} catch {}
			}

			if (hasValue) {
				if (flags & Q_VAL_PLUS) {
					value = value.replaceAll("+", " ");
				}

				if (flags & Q_VAL_PCT) {
					try {
						value = decodeURIComponent(value);
					} catch {}
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
			} else if (multiValue.has(key)) {
				(params[key] as unknown[]).push(parsed);
			} else {
				multiValue.add(key);

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
