import { HEX_VALUES } from "@/utils/urls/hex-values";

const NATIVE_DECODE_MIN_LENGTH = 24;
const NATIVE_DECODE_MIN_WIDE_LENGTH = 18;
const NATIVE_DECODE_MIN_MIXED_LENGTH = 48;
const NATIVE_DECODE_MIXED_ESCAPES = 4;
const NATIVE_DECODE_MIXED_WINDOW = 32;
const NATIVE_DECODE_MIXED_PREFIX = 16;
const NATIVE_DECODE_MIXED_SUFFIX = 12;

const hasDenseOpening = (
	value: string,
	firstPercentIndex: number,
	secondPercentIndex: number,
): boolean => {
	const windowEnd = firstPercentIndex + NATIVE_DECODE_MIXED_WINDOW;

	let escapeCount = 1;
	let probeIndex = secondPercentIndex;

	while (probeIndex !== -1 && probeIndex < windowEnd) {
		escapeCount++;

		if (escapeCount === NATIVE_DECODE_MIXED_ESCAPES) {
			const { length } = value;
			const lastPercentIndex = value.lastIndexOf("%");

			return (
				lastPercentIndex >= length - NATIVE_DECODE_MIXED_SUFFIX &&
				lastPercentIndex + 2 < length
			);
		}

		probeIndex = value.indexOf("%", probeIndex + 3);
	}

	return false;
};

export const decodePathParam = (value: string): string => {
	const firstPercentIndex = value.indexOf("%");

	if (firstPercentIndex === -1) {
		return value;
	}

	const { length } = value;
	const tailLength = length - firstPercentIndex;

	let isNative = false;
	let probedFrom = -1;
	let probedIndex = -1;

	if (tailLength >= NATIVE_DECODE_MIN_WIDE_LENGTH) {
		const leadCharCode = value.charCodeAt(firstPercentIndex + 1);

		isNative =
			leadCharCode < 256 &&
			HEX_VALUES[leadCharCode]! >=
				(tailLength >= NATIVE_DECODE_MIN_LENGTH ? 8 : 14) &&
			value.charCodeAt(firstPercentIndex + 3) === 37 &&
			value.charCodeAt(firstPercentIndex + 6) === 37 &&
			value.charCodeAt(length - 3) === 37;

		if (
			!isNative &&
			tailLength >= NATIVE_DECODE_MIN_MIXED_LENGTH &&
			firstPercentIndex < NATIVE_DECODE_MIXED_PREFIX
		) {
			probedFrom = firstPercentIndex + 3;
			probedIndex = value.indexOf("%", probedFrom);
			isNative =
				probedIndex !== -1 &&
				hasDenseOpening(value, firstPercentIndex, probedIndex);
		}
	}

	if (isNative) {
		try {
			return decodeURIComponent(value);
		} catch {
			// malformed escapes take the tolerant decoder below
		}
	}

	let decoded = value.slice(0, firstPercentIndex);
	let i = firstPercentIndex;

	while (i < length) {
		if (value.charCodeAt(i) !== 37) {
			const nextPercentIndex =
				i === probedFrom ? probedIndex : value.indexOf("%", i);
			const runEnd = nextPercentIndex === -1 ? length : nextPercentIndex;

			if (runEnd - i > 2) {
				decoded += value.slice(i, runEnd);
				i = runEnd;
			} else {
				while (i < runEnd) {
					decoded += value[i];
					i++;
				}
			}

			if (nextPercentIndex === -1) {
				break;
			}

			continue;
		}

		if (i + 2 >= length) {
			decoded += "�";
			i++;

			continue;
		}

		// char codes above 255 are never hex digits
		const highCharCode = value.charCodeAt(i + 1);
		const highNibble = highCharCode < 256 ? HEX_VALUES[highCharCode]! : -1;
		const lowCharCode = value.charCodeAt(i + 2);
		const lowNibble = lowCharCode < 256 ? HEX_VALUES[lowCharCode]! : -1;

		if (highNibble === -1 || lowNibble === -1) {
			decoded += "�";

			i += highCharCode > 127 ? 1 : lowCharCode > 127 ? 2 : 3;

			continue;
		}

		i += 3;

		if (highNibble < 8) {
			decoded += String.fromCharCode(highNibble * 16 + lowNibble);

			continue;
		}

		let codePoint: number;
		let minimumCodePoint: number;
		let missing: number;

		if (highNibble === 12 || highNibble === 13) {
			codePoint = (highNibble - 12) * 16 + lowNibble;
			minimumCodePoint = 128;
			missing = 1;
		} else if (highNibble === 14) {
			codePoint = lowNibble;
			minimumCodePoint = 2048;
			missing = 2;
		} else if (highNibble === 15 && lowNibble < 8) {
			codePoint = lowNibble;
			minimumCodePoint = 65_536;
			missing = 3;
		} else {
			decoded += "�";

			continue;
		}

		while (missing > 0 && i + 2 < length && value.charCodeAt(i) === 37) {
			const continuationHighCharCode = value.charCodeAt(i + 1);
			const continuationHighNibble =
				continuationHighCharCode < 256
					? HEX_VALUES[continuationHighCharCode]!
					: -1;

			if (continuationHighNibble < 8 || continuationHighNibble > 11) {
				break;
			}

			const continuationLowCharCode = value.charCodeAt(i + 2);
			const continuationLowNibble =
				continuationLowCharCode < 256
					? HEX_VALUES[continuationLowCharCode]!
					: -1;

			if (continuationLowNibble === -1) {
				break;
			}

			codePoint =
				codePoint * 64 +
				(continuationHighNibble - 8) * 16 +
				continuationLowNibble;
			missing--;
			i += 3;
		}

		decoded +=
			missing !== 0 ||
			codePoint < minimumCodePoint ||
			codePoint > 1_114_111 ||
			(codePoint >= 55_296 && codePoint <= 57_343)
				? "�"
				: String.fromCodePoint(codePoint);
	}

	return decoded;
};
