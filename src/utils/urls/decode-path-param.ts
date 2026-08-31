// hexadecimal digit values indexed by char code, -1 for every other character
const HEX_VALUES = /* @__PURE__ */ (() => {
	const values = new Int8Array(256).fill(-1);

	// "0" (48) - "9" (57)
	for (let charCode = 48; charCode <= 57; charCode++) {
		values[charCode] = charCode - 48;
	}

	// 87 = "a" (97) - 10, mapping "a"-"f" to 10-15, and "- 32" uppercase
	for (let charCode = 97; charCode <= 102; charCode++) {
		values[charCode] = charCode - 87;
		values[charCode - 32] = charCode - 87;
	}

	return values;
})();

// pending percent-decoded bytes, flushed as UTF-8 when a run ends
let pendingBytes = new Uint8Array(64);

/**
 * Decodes the first `count` pending bytes as a UTF-8 sequence.
 */
const decodeUtf8Bytes = (count: number) => {
	// hoisted out of the loop
	const bytes = pendingBytes;

	let decoded = "";
	let i = 0;

	while (i < count) {
		const firstByte = bytes[i]!;

		let codePoint: number;
		let minimumCodePoint: number;
		let sequenceLength: number;

		// lead byte gives the sequence length: 2, 3 or 4 bytes
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

		while (sequenceEnd < i + sequenceLength && sequenceEnd < count) {
			const continuationByte = bytes[sequenceEnd]!;

			// continuation bytes must match 10xxxxxx
			if ((continuationByte & 192) !== 128) {
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

		// reject overlong encodings, code points above U+10FFFF and surrogates
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
 * decodePathParam("%ED%A0%80"); // "�"
 * ```
 */
export const decodePathParam = (value: string) => {
	const firstPercentIndex = value.indexOf("%");

	if (firstPercentIndex === -1) {
		return value;
	}

	const length = value.length;

	let decoded = value.substring(0, firstPercentIndex);
	let i = firstPercentIndex;
	let pending = 0;

	while (i < length) {
		// literal character, not "%" (37)
		if (value.charCodeAt(i) !== 37) {
			if (pending > 0) {
				decoded += decodeUtf8Bytes(pending);
				pending = 0;
			}

			const nextPercentIndex = value.indexOf("%", i);
			const runEnd = nextPercentIndex === -1 ? length : nextPercentIndex;

			// a run of more than two characters copies at once
			if (runEnd - i > 2) {
				decoded += value.substring(i, runEnd);
				i = runEnd;
			} else {
				while (i < runEnd) {
					decoded += value[i];
					i++;
				}
			}

			// no escape left: the run above ended the value
			if (nextPercentIndex === -1) {
				break;
			}

			continue;
		}

		// truncated "%xx"
		if (i + 2 >= length) {
			if (pending > 0) {
				decoded += decodeUtf8Bytes(pending);
				pending = 0;
			}

			decoded += "�";
			i++;

			continue;
		}

		// a char code above 255 reads as undefined
		const highCharCode = value.charCodeAt(i + 1);
		const highNibble = HEX_VALUES[highCharCode] ?? -1;
		const lowCharCode = value.charCodeAt(i + 2);
		const lowNibble = HEX_VALUES[lowCharCode] ?? -1;

		if (highNibble === -1 || lowNibble === -1) {
			if (pending > 0) {
				decoded += decodeUtf8Bytes(pending);
				pending = 0;
			}

			decoded += "�";

			// a non-ASCII character closes no escape
			i += highCharCode > 127 ? 1 : lowCharCode > 127 ? 2 : 3;

			continue;
		}

		const byte = (highNibble << 4) | lowNibble;

		// ASCII decodes directly; higher bytes join a multi-byte run
		if (byte <= 127) {
			if (pending > 0) {
				decoded += decodeUtf8Bytes(pending);
				pending = 0;
			}

			decoded += String.fromCharCode(byte);
		} else {
			// grow the buffer to fit the run
			if (pending === pendingBytes.length) {
				const grown = new Uint8Array(pending * 2);

				grown.set(pendingBytes);

				pendingBytes = grown;
			}

			pendingBytes[pending] = byte;
			pending++;
		}

		i += 3;
	}

	if (pending > 0) {
		decoded += decodeUtf8Bytes(pending);
	}

	return decoded;
};
