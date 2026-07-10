/**
 * Decode a single hexadecimal character code to its numeric value.
 */
const hexCharCodeToValue = (charCode: number) => {
	if (charCode >= 48 && charCode <= 57) {
		return charCode - 48;
	}

	const lowerCharCode = charCode | 32;

	return lowerCharCode >= 97 && lowerCharCode <= 102
		? lowerCharCode - 87
		: -1;
};

/**
 * Decode UTF-8 bytes using Bun's malformed-sequence grouping.
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

			if (
				continuationByte === undefined ||
				(continuationByte & 192) !== 128
			) {
				break;
			}

			codePoint = (codePoint << 6) | (continuationByte & 63);
			sequenceEnd++;
		}

		if (sequenceEnd !== i + sequenceLength) {
			decoded += "�";
			i = sequenceEnd;

			continue;
		}

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
 * Percent-decode a route parameter with Bun's U+FFFD replacement rules.
 */
export const decodePathParam = (value: string) => {
	if (value.indexOf("%") === -1) {
		return value;
	}

	let bytes: number[] = [];
	let decoded = "";
	let i = 0;

	const flushBytes = () => {
		if (bytes.length === 0) {
			return;
		}

		decoded += decodeUtf8Bytes(bytes);
		bytes = [];
	};

	while (i < value.length) {
		if (value.charCodeAt(i) !== 37) {
			flushBytes();

			decoded += value[i];
			i++;

			continue;
		}

		if (i + 2 >= value.length) {
			flushBytes();

			decoded += "�";
			i++;

			continue;
		}

		const highNibble = hexCharCodeToValue(value.charCodeAt(i + 1));
		const lowNibble = hexCharCodeToValue(value.charCodeAt(i + 2));

		if (highNibble === -1 || lowNibble === -1) {
			flushBytes();

			decoded += "�";
			i += 3;

			continue;
		}

		bytes.push((highNibble << 4) | lowNibble);
		i += 3;
	}

	flushBytes();

	return decoded;
};
