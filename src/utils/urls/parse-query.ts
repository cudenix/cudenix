import { HEX_VALUES } from "@/utils/urls/hex-values";

// reused across calls
const encoder = new TextEncoder();

// "ignoreBOM" keeps a decoded U+FEFF
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

/**
 * Percent-decodes a query component.
 */
const decodeQueryComponent = (component: string): string => {
	const input = encoder.encode(component);
	const { length } = input;
	const output = new Uint8Array(length);

	let written = 0;

	for (let i = 0; i < length; i++) {
		const byte = input[i]!;

		// "%" (37) escapes only with two hex digits
		if (byte === 37 && i + 2 < length) {
			const highNibble = HEX_VALUES[input[i + 1]!]!;
			const lowNibble = HEX_VALUES[input[i + 2]!]!;

			if (highNibble !== -1 && lowNibble !== -1) {
				output[written++] = highNibble * 16 + lowNibble;
				i += 2;

				continue;
			}
		}

		output[written++] = byte;
	}

	return decoder.decode(output.subarray(0, written));
};

/**
 * Replaces every "+" in a query component with a space.
 */
const replacePlus = (component: string): string => {
	const { length } = component;

	let output = "";
	let last = 0;

	for (let i = 0; i < length; i++) {
		// "+" (43) becomes a space
		if (component.charCodeAt(i) === 43) {
			output += `${component.slice(last, i)} `;
			last = i + 1;
		}
	}

	return last === 0 ? component : output + component.slice(last);
};

/**
 * Parses the query string from a URL.
 *
 * @example
 * ```typescript
 * parseQuery("/a?b=v1&c=v2"); // { b: "v1", c: "v2" }
 * parseQuery("/a?b=v1&b=v2"); // { b: ["v1", "v2"] }
 * parseQuery('/a?b={"c":1}'); // { b: { c: 1 } }
 * ```
 */
export const parseQuery = (url: string): Record<string, unknown> => {
	const params = Object.create(null) as Record<string, unknown>;

	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return params;
	}

	// a "?" behind a "#" (35) starts no query
	if (url.lastIndexOf("#", queryIndex) !== -1) {
		return params;
	}

	const urlLength = url.length;

	// tracks keys repeated in the query
	let multiValueKeys: string[] | undefined;
	let i = queryIndex + 1;

	while (i < urlLength) {
		const keyStart = i;

		// decode steps the key and value need
		let keyHasPlus = false;
		let keyHasPercent = false;
		let valueHasPlus = false;
		let valueHasPercent = false;

		while (i < urlLength) {
			const charCode = url.charCodeAt(i);

			// stop at "=" (61), "&" (38) or "#" (35)
			if (charCode === 61 || charCode === 38 || charCode === 35) {
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

		// "=" (61) starts the value
		const hasValue = i < urlLength && url.charCodeAt(i) === 61;

		let key = url.slice(keyStart, i);
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

				// stop at "&" (38) or "#" (35)
				if (charCode === 38 || charCode === 35) {
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

			value = url.slice(valueStart, i);
		} else {
			value = "";
		}

		if (key.length > 0) {
			if (keyHasPlus) {
				key = replacePlus(key);
			}

			if (keyHasPercent) {
				try {
					key = decodeURIComponent(key);
				} catch {
					// retry with the tolerant decoder
					key = decodeQueryComponent(key);
				}
			}

			let parsed = value as unknown;

			if (hasValue) {
				if (valueHasPlus) {
					value = replacePlus(value);
					parsed = value;
				}

				if (valueHasPercent) {
					try {
						value = decodeURIComponent(value);
					} catch {
						value = decodeQueryComponent(value);
					}

					parsed = value;
					firstCharCode = value.charCodeAt(0);
				}

				// "{" (123) or "[" (91) suggests a JSON value
				if (firstCharCode === 123 || firstCharCode === 91) {
					const lastCharCode = value.charCodeAt(value.length - 1);

					// require matching "}" (125) or "]" (93)
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
			} else if (multiValueKeys?.includes(key) === true) {
				(params[key] as unknown[]).push(parsed);
			} else {
				// first repeat: promote the value to an array
				multiValueKeys ??= [];
				multiValueKeys.push(key);

				params[key] = [params[key], parsed];
			}
		}

		// end of query or "#" (35) fragment
		if (i >= urlLength || url.charCodeAt(i) === 35) {
			break;
		}

		i++;
	}

	return params;
};
