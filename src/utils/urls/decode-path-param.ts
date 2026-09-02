// hexadecimal digit values indexed by char code
const HEX_VALUES = /* @__PURE__ */ (() => {
	const values = new Int8Array(256).fill(-1);

	// "0" (48) - "9" (57)
	for (let charCode = 48; charCode <= 57; charCode++) {
		values[charCode] = charCode - 48;
	}

	// "a"-"f" map to 10-15, "- 32" for uppercase
	for (let charCode = 97; charCode <= 102; charCode++) {
		values[charCode] = charCode - 87;
		values[charCode - 32] = charCode - 87;
	}

	return values;
})();

// tail length past which a dense non-ASCII run goes native
const NATIVE_DECODE_MIN_LENGTH = 24;

// pending percent-decoded bytes
let pendingBytes = new Uint8Array(64);

/**
 * Decodes the pending bytes as UTF-8 sequences.
 */
const decodeUtf8Bytes = (count: number) => {
	const bytes = pendingBytes;

	let decoded = "";
	let i = 0;

	while (i < count) {
		const firstByte = bytes[i]!;

		let codePoint: number;
		let minimumCodePoint: number;
		let sequenceLength: number;

		// the lead byte gives the sequence length
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

		// sequence cut short
		if (sequenceEnd !== i + sequenceLength) {
			decoded += "�";
			i = sequenceEnd;

			continue;
		}

		// reject overlongs, surrogates and out-of-range
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

	// a dense non-ASCII run goes to the native decoder
	if (
		length - firstPercentIndex >= NATIVE_DECODE_MIN_LENGTH &&
		(HEX_VALUES[value.charCodeAt(firstPercentIndex + 1)] ?? -1) >= 8 &&
		value.charCodeAt(firstPercentIndex + 3) === 37 &&
		value.charCodeAt(firstPercentIndex + 6) === 37 &&
		value.charCodeAt(length - 3) === 37
	) {
		try {
			return decodeURIComponent(value);
		} catch {
			// malformed escapes take the tolerant decoder below
		}
	}

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

			// no escape left
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

		// ASCII decodes directly, higher bytes go pending
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
