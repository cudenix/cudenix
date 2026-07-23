/**
 * Converts a hexadecimal character code to a number.
 */
const hexCharCodeToValue = (charCode: number) => {
	// "0" (48) - "9" (57)
	if (charCode >= 48 && charCode <= 57) {
		return charCode - 48;
	}

	// "| 32" lowercases, so only "a" (97) - "f" (102) needs checking
	const lowerCharCode = charCode | 32;

	// 87 = "a" (97) - 10, mapping "a"-"f" to 10-15
	return lowerCharCode >= 97 && lowerCharCode <= 102
		? lowerCharCode - 87
		: -1;
};

/**
 * Decodes a UTF-8 byte sequence.
 */
const decodeUtf8Bytes = (bytes: number[]) => {
	let decoded = "";
	let i = 0;

	while (i < bytes.length) {
		const firstByte = bytes[i];

		if (firstByte === undefined) {
			break;
		}

		if (firstByte <= 127) {
			decoded += String.fromCharCode(firstByte);
			i++;

			continue;
		}

		let codePoint: number;
		let minimumCodePoint: number;
		let sequenceLength: number;

		// lead byte determines the sequence length
		if (firstByte >= 192 && firstByte <= 223) {
			codePoint = firstByte & 31;
			minimumCodePoint = 128;
			sequenceLength = 2;
		} else if (firstByte >= 224 && firstByte <= 239) {
			codePoint = firstByte & 15;
			minimumCodePoint = 2048;
			sequenceLength = 3;
		} else if (firstByte >= 240 && firstByte <= 247) {
			codePoint = firstByte & 7;
			minimumCodePoint = 65_536;
			sequenceLength = 4;
		} else {
			decoded += "�";
			i++;

			continue;
		}

		let sequenceEnd = i + 1;

		while (sequenceEnd < i + sequenceLength && sequenceEnd < bytes.length) {
			const continuationByte = bytes[sequenceEnd];

			// continuation bytes must match 10xxxxxx
			if (
				continuationByte === undefined ||
				(continuationByte & 192) !== 128
			) {
				break;
			}

			codePoint = (codePoint << 6) | (continuationByte & 63);
			sequenceEnd++;
		}

		// sequence cut short: end of input or an invalid continuation byte
		if (sequenceEnd !== i + sequenceLength) {
			decoded += "�";
			i = sequenceEnd;

			continue;
		}

		// reject overlong encodings, out-of-range and surrogate code points
		if (
			codePoint < minimumCodePoint ||
			codePoint > 1_114_111 ||
			(codePoint >= 55_296 && codePoint <= 57_343)
		) {
			decoded += "�";
		} else {
			decoded += String.fromCodePoint(codePoint);
		}

		i = sequenceEnd;
	}

	return decoded;
};

/**
 * Decodes a percent-encoded route parameter.
 *
 * @example
 * ```typescript
 * decodePathParam("a%20b"); // "a b"
 * ```
 */
export const decodePathParam = (value: string) => {
	const firstPercentIndex = value.indexOf("%");

	if (firstPercentIndex === -1) {
		return value;
	}

	const length = value.length;

	let lastPercentIndex = length;

	// long values: locate the last "%" (37) so the literal tail is copied in bulk
	if (length >= 32) {
		// "%xx" is 3 chars, so a trailing escape puts the last "%" in the final 3 positions
		if (value.charCodeAt(length - 1) === 37) {
			lastPercentIndex = length - 1;
		} else if (value.charCodeAt(length - 2) === 37) {
			lastPercentIndex = length - 2;
		} else if (value.charCodeAt(length - 3) === 37) {
			lastPercentIndex = length - 3;
		} else {
			lastPercentIndex = value.lastIndexOf("%");
		}
	}

	// pending percent-decoded bytes, flushed as UTF-8 when a run ends
	const bytes: number[] = [];

	let decoded = value.substring(0, firstPercentIndex);
	let i = firstPercentIndex;

	while (i < length) {
		// literal character, not "%" (37)
		if (value.charCodeAt(i) !== 37) {
			if (bytes.length > 0) {
				decoded += decodeUtf8Bytes(bytes);
				bytes.length = 0;
			}

			// past the last "%": append the rest in one substring
			if (i > lastPercentIndex) {
				decoded += value.substring(i);

				break;
			}

			decoded += value[i];
			i++;

			continue;
		}

		// truncated "%xx"
		if (i + 2 >= length) {
			if (bytes.length > 0) {
				decoded += decodeUtf8Bytes(bytes);
				bytes.length = 0;
			}

			decoded += "�";
			i++;

			continue;
		}

		const highNibble = hexCharCodeToValue(value.charCodeAt(i + 1));
		const lowNibble = hexCharCodeToValue(value.charCodeAt(i + 2));

		if (highNibble === -1 || lowNibble === -1) {
			if (bytes.length > 0) {
				decoded += decodeUtf8Bytes(bytes);
				bytes.length = 0;
			}

			decoded += "�";
			i += 3;

			continue;
		}

		const byte = (highNibble << 4) | lowNibble;

		// ASCII decodes directly; higher bytes join a multi-byte run
		if (byte <= 127) {
			if (bytes.length > 0) {
				decoded += decodeUtf8Bytes(bytes);
				bytes.length = 0;
			}

			decoded += String.fromCharCode(byte);
		} else {
			bytes.push(byte);
		}

		i += 3;
	}

	if (bytes.length > 0) {
		decoded += decodeUtf8Bytes(bytes);
	}

	return decoded;
};
