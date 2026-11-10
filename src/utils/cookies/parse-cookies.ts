import { decodePathParam } from "@/utils/urls/decode-path-param";

// slots of the name cache, a power of two
const NAME_CACHE_SIZE = 1024;
// longest name the cache keeps
const NAME_CACHE_MAX_LENGTH = 64;

// names already used as keys, by hash slot
const nameCache = new Array<string>(NAME_CACHE_SIZE).fill("");

/**
 * Parses cookies from a `Cookie` request header.
 *
 * @example
 * ```typescript
 * const cookies = parseCookies("a=v1; b=v2; c=a%20b");
 *
 * cookies.a; // "v1"
 * cookies.b; // "v2"
 * cookies.c; // "a b"
 * ```
 */
export const parseCookies = (header: string): Record<string, string> => {
	const cookies = Object.create(null) as Record<string, string>;

	if (!header) {
		return cookies;
	}

	const { length } = header;

	// next "%" (37) at or after the current value
	let percentIndex = header.indexOf("%");
	let start = 0;

	while (start < length) {
		// each pair ends at the next ";" (59)
		let end = header.indexOf(";", start);

		if (end === -1) {
			end = length;
		}

		let nameStart = start;

		// skip leading " " (32) and "\t" (9)
		while (nameStart < end) {
			const charCode = header.charCodeAt(nameStart);

			if (charCode !== 32 && charCode !== 9) {
				break;
			}

			nameStart++;
		}

		let equalsIndex = nameStart;
		let hash = 0;

		// scan and hash the name up to "=" (61)
		while (equalsIndex < end) {
			const charCode = header.charCodeAt(equalsIndex);

			if (charCode === 61) {
				break;
			}

			hash = ((hash << 5) - hash + charCode) | 0;
			equalsIndex++;
		}

		// ignore pairs without an "="
		if (equalsIndex < end) {
			let nameEnd = equalsIndex;

			while (nameEnd > nameStart) {
				const charCode = header.charCodeAt(nameEnd - 1);

				if (charCode !== 32 && charCode !== 9) {
					break;
				}

				nameEnd--;
			}

			// ignore pairs without a name
			if (nameEnd > nameStart) {
				let valueStart = equalsIndex + 1;
				let valueEnd = end;

				// skip leading whitespace
				while (valueStart < valueEnd) {
					const charCode = header.charCodeAt(valueStart);

					if (charCode !== 32 && charCode !== 9) {
						break;
					}

					valueStart++;
				}

				while (valueEnd > valueStart) {
					const charCode = header.charCodeAt(valueEnd - 1);

					if (charCode !== 32 && charCode !== 9) {
						break;
					}

					valueEnd--;
				}

				const nameLength = nameEnd - nameStart;

				let name: string;

				if (nameLength === 1) {
					name = header[nameStart]!;
				} else {
					const slot = hash & (NAME_CACHE_SIZE - 1);

					name = nameCache[slot]!;

					// reuse the cached string when it is this name
					if (
						name.length !== nameLength ||
						!header.startsWith(name, nameStart)
					) {
						name = header.slice(nameStart, nameEnd);

						if (nameLength <= NAME_CACHE_MAX_LENGTH) {
							nameCache[slot] = name;
						}
					}
				}

				// move to the first "%" inside or after this value
				if (percentIndex !== -1 && percentIndex < valueStart) {
					percentIndex = header.indexOf("%", valueStart);
				}

				// first one wins, only a value with a "%" is decoded
				cookies[name] ??=
					percentIndex !== -1 && percentIndex < valueEnd
						? decodePathParam(header.slice(valueStart, valueEnd))
						: header.slice(valueStart, valueEnd);
			}
		}

		// skip the ";"
		start = end + 1;
	}

	return cookies;
};
