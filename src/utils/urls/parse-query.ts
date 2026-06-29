import { Empty } from "@/utils/objects/empty";

const Q_KEY_PLUS = 1;
const Q_KEY_PCT = 2;
const Q_VAL_PLUS = 4;
const Q_VAL_PCT = 8;

/**
 * Parse a URL's query string into a dictionary keyed by parameter name.
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

	const urlLength = url.length;

	let multiValueKeys: Set<string> | undefined;
	let i = queryIndex + 1;

	while (i < urlLength) {
		const keyStart = i;

		let flags = 0;

		while (i < urlLength) {
			const charCode = url.charCodeAt(i);

			if (charCode === 61 || charCode === 38 || charCode === 35) {
				break;
			}

			if (charCode === 43) {
				flags |= Q_KEY_PLUS;
			} else if (charCode === 37) {
				flags |= Q_KEY_PCT;
			}

			i++;
		}

		const hasValue = i < urlLength && url.charCodeAt(i) === 61;

		let key = url.substring(keyStart, i);
		let value: string;
		let firstCharCode = -1;

		if (hasValue) {
			i++;

			const valueStart = i;

			if (i < urlLength) {
				firstCharCode = url.charCodeAt(i);
			}

			while (i < urlLength) {
				const charCode = url.charCodeAt(i);

				if (charCode === 38 || charCode === 35) {
					break;
				}

				if (charCode === 43) {
					flags |= Q_VAL_PLUS;
				} else if (charCode === 37) {
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

			let parsed = value as unknown;

			if (hasValue) {
				if (flags & Q_VAL_PLUS) {
					value = value.replaceAll("+", " ");
					parsed = value;
				}

				if (flags & Q_VAL_PCT) {
					try {
						value = decodeURIComponent(value);
						parsed = value;
						firstCharCode = value.charCodeAt(0);
					} catch {}
				}

				if (firstCharCode === 123 || firstCharCode === 91) {
					const lastCharCode = value.charCodeAt(value.length - 1);

					if (
						(firstCharCode === 123 && lastCharCode === 125) ||
						(firstCharCode === 91 && lastCharCode === 93)
					) {
						try {
							parsed = JSON.parse(value);
						} catch {
							parsed = value;
						}
					}
				}
			}

			if (params[key] === undefined) {
				params[key] = parsed;
			} else if (multiValueKeys?.has(key)) {
				(params[key] as unknown[]).push(parsed);
			} else {
				if (!multiValueKeys) {
					multiValueKeys = new Set<string>();
				}

				multiValueKeys.add(key);

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
