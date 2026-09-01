import { Empty } from "@/utils/objects/empty";
import { decodePathParam } from "@/utils/urls/decode-path-param";

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
export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

	if (!header) {
		return cookies;
	}

	const length = header.length;
	// a "%" anywhere means a value needs decoding
	const isEncoded = header.indexOf("%") !== -1;

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

		// scan the name up to "=" (61)
		while (equalsIndex < end && header.charCodeAt(equalsIndex) !== 61) {
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

				// only the value is decoded
				const name = header.substring(nameStart, nameEnd);

				// first one wins
				if (cookies[name] === undefined) {
					cookies[name] = isEncoded
						? decodePathParam(
								header.substring(valueStart, valueEnd),
							)
						: header.substring(valueStart, valueEnd);
				}
			}
		}

		// skip the ";"
		start = end + 1;
	}

	return cookies;
};
