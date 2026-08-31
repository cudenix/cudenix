import { Empty } from "@/utils/objects/empty";

// scan flags marking which decode steps a key/value needs
const KEY_HAS_PLUS = 1;
const KEY_HAS_PERCENT = 2;
const VALUE_HAS_PLUS = 4;
const VALUE_HAS_PERCENT = 8;

// length past which a component goes to the native searches
const SCAN_LIMIT = 64;

// length past which the "+" swap goes to "split"/"join"
const REPLACE_ALL_LENGTH = 128;

// reused across calls
const encoder = new TextEncoder();

// "ignoreBOM" keeps a decoded U+FEFF
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
 * Finds where a long query component ends and which decode steps it needs.
 */
const scanComponent = (
	url: string,
	from: number,
	urlLength: number,
	isKey: boolean,
) => {
	// "&" (38) closes the pair, "#" (35) the whole query
	let end = url.indexOf("&", from);

	if (end === -1) {
		end = urlLength;
	}

	const hashIndex = url.indexOf("#", from);

	if (hashIndex !== -1 && hashIndex < end) {
		end = hashIndex;
	}

	// "=" (61) closes a key, but never a value
	if (isKey) {
		const equalsIndex = url.indexOf("=", from);

		if (equalsIndex !== -1 && equalsIndex < end) {
			end = equalsIndex;
		}
	}

	const plusIndex = url.indexOf("+", from);
	const percentIndex = url.indexOf("%", from);

	return {
		end,
		// in the KEY_HAS_* positions, shifted by the value caller
		flags:
			(plusIndex !== -1 && plusIndex < end ? KEY_HAS_PLUS : 0) |
			(percentIndex !== -1 && percentIndex < end ? KEY_HAS_PERCENT : 0),
	};
};

/**
 * Percent-decodes a query component the way the URL parser does.
 *
 * Never throws: a "%" without two hexadecimal digits after it stays literal,
 * and invalid UTF-8 becomes one replacement character per maximal subpart.
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

	// past this length one split beats scanning and slicing by hand
	if (length > REPLACE_ALL_LENGTH) {
		return component.split("+").join(" ");
	}

	let output = "";
	let last = 0;

	for (let i = 0; i < length; i++) {
		// "+" (43) stands for a space in a query component
		if (component.charCodeAt(i) === 43) {
			output += `${component.substring(last, i)} `;
			last = i + 1;
		}
	}

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

	// a "?" behind a "#" (35) sits in the fragment and starts no query
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
		// the scan bound is hoisted out of the loop
		let scanEnd = keyStart + SCAN_LIMIT;

		if (scanEnd > urlLength) {
			scanEnd = urlLength;
		}

		while (i < scanEnd) {
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

		// the key outran the bound, so the rest of it goes to the searches
		if (i === scanEnd && scanEnd !== urlLength) {
			const scanned = scanComponent(url, i, urlLength, true);

			i = scanned.end;
			flags |= scanned.flags;
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

			let valueScanEnd = valueStart + SCAN_LIMIT;

			if (valueScanEnd > urlLength) {
				valueScanEnd = urlLength;
			}

			while (i < valueScanEnd) {
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

			// the value outran the bound, so the rest goes to the searches
			if (i === valueScanEnd && valueScanEnd !== urlLength) {
				const scanned = scanComponent(url, i, urlLength, false);

				i = scanned.end;
				flags |= scanned.flags << 2;
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
					// redo the whole component with the tolerant decoder
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
