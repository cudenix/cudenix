import { Empty } from "@/utils/objects/empty";

// scan flags marking which decode steps a key/value needs
const KEY_HAS_PLUS = 1;
const KEY_HAS_PERCENT = 2;
const VALUE_HAS_PLUS = 4;
const VALUE_HAS_PERCENT = 8;

const encoder = new TextEncoder();

// "ignoreBOM" keeps a decoded U+FEFF, which is what the URL parser does
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

/**
 * Converts a hexadecimal byte to its value, or -1 if not hexadecimal.
 */
const hexByteToValue = (byte: number) => {
	// "0" (48) - "9" (57)
	if (byte >= 48 && byte <= 57) {
		return byte - 48;
	}

	// "| 32" lowercases letters
	const lowerByte = byte | 32;

	// 87 = "a" (97) - 10, mapping "a"-"f" to 10-15
	return lowerByte >= 97 && lowerByte <= 102 ? lowerByte - 87 : -1;
};

/**
 * Percent-decodes a query component the way the URL parser does.
 *
 * Runs only where `decodeURIComponent` throws, and never throws itself: a "%"
 * without two hexadecimal digits after it stays literal, and invalid UTF-8
 * becomes one replacement character per maximal subpart. That is what
 * `URLSearchParams` does with a query, and unlike `decodeURIComponent` it
 * still decodes the well-formed escapes standing next to a malformed one.
 */
const decodeQueryComponent = (component: string) => {
	const input = encoder.encode(component);
	const length = input.length;
	const output = new Uint8Array(length);

	let written = 0;

	for (let i = 0; i < length; i++) {
		const byte = input[i]!;

		// "%" (37) only escapes when two hexadecimal digits follow it
		if (byte === 37 && i + 2 < length) {
			const highNibble = hexByteToValue(input[i + 1]!);
			const lowNibble = hexByteToValue(input[i + 2]!);

			if (highNibble !== -1 && lowNibble !== -1) {
				output[written++] = (highNibble << 4) | lowNibble;
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
 *
 * @example
 * ```typescript
 * replacePlus("a+b"); // "a b"
 * ```
 */
const replacePlus = (component: string) => {
	const length = component.length;

	let output = "";
	let last = 0;

	for (let i = 0; i < length; i++) {
		// "+" (43) stands for a space in a query component
		if (component.charCodeAt(i) === 43) {
			output += `${component.substring(last, i)} `;
			last = i + 1;
		}
	}

	// "split"/"join" and "replaceAll" both allocate an intermediate array or a
	// matcher for what is a single-character swap, so scanning by hand and
	// slicing between the hits is around twice as fast
	return last === 0 ? component : output + component.substring(last);
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
export const parseQuery = (url: string) => {
	const params = new Empty() as Record<string, unknown>;

	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return params;
	}

	// a "?" behind a "#" (35) sits inside the fragment and starts no query, so
	// "/a#c?b=v1" has no parameters at all, exactly like `new URL(url)` reads
	// it; searching backwards bounds the extra scan by the path, not the query
	if (url.lastIndexOf("#", queryIndex) !== -1) {
		return params;
	}

	const urlLength = url.length;

	// tracks keys repeated in the query
	let multiValueKeys: Set<string> | undefined;
	let i = queryIndex + 1;

	while (i < urlLength) {
		const keyStart = i;

		let flags = 0;

		while (i < urlLength) {
			const charCode = url.charCodeAt(i);

			// stop at "=" (61), "&" (38) or "#" (35)
			if (charCode === 61 || charCode === 38 || charCode === 35) {
				break;
			}

			// "+" (43) and "%" (37) require key decoding
			if (charCode === 43) {
				flags |= KEY_HAS_PLUS;
			} else if (charCode === 37) {
				flags |= KEY_HAS_PERCENT;
			}

			i++;
		}

		// "=" (61) starts the value
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

				// stop at "&" (38) or "#" (35)
				if (charCode === 38 || charCode === 35) {
					break;
				}

				// "+" (43) and "%" (37) require value decoding
				if (charCode === 43) {
					flags |= VALUE_HAS_PLUS;
				} else if (charCode === 37) {
					flags |= VALUE_HAS_PERCENT;
				}

				i++;
			}

			value = url.substring(valueStart, i);
		} else {
			value = "";
		}

		if (key.length > 0) {
			if (flags & KEY_HAS_PLUS) {
				key = replacePlus(key);
			}

			if (flags & KEY_HAS_PERCENT) {
				try {
					key = decodeURIComponent(key);
				} catch {
					// all-or-nothing: it threw on the first bad escape and
					// discarded the good ones beside it, so redo the whole
					// component with the decoder that tolerates them
					key = decodeQueryComponent(key);
				}
			}

			let parsed = value as unknown;

			if (hasValue) {
				if (flags & VALUE_HAS_PLUS) {
					value = replacePlus(value);
					parsed = value;
				}

				if (flags & VALUE_HAS_PERCENT) {
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
			} else if (multiValueKeys?.has(key)) {
				(params[key] as unknown[]).push(parsed);
			} else {
				// first repeat: promote the value to an array
				if (!multiValueKeys) {
					multiValueKeys = new Set<string>();
				}

				multiValueKeys.add(key);

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
