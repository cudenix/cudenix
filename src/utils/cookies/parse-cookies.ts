import { Empty } from "@/utils/objects/empty";

/**
 * Parses cookies from a `Cookie` request header.
 *
 * @example
 * ```typescript
 * const cookies = parseCookies("a=v1; b=v2");
 *
 * cookies.a; // "v1"
 * cookies.b; // "v2"
 * ```
 */
export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

	if (!header) {
		return cookies;
	}

	const length = header.length;

	let start = 0;

	while (start < length) {
		// each pair ends at the next ";" (59) or at the end of the header
		let end = header.indexOf(";", start);

		if (end === -1) {
			end = length;
		}

		let nameStart = start;

		// optional whitespace, " " (32) or "\t" (9), is not part of the name
		while (nameStart < end) {
			const charCode = header.charCodeAt(nameStart);

			if (charCode !== 32 && charCode !== 9) {
				break;
			}

			nameStart++;
		}

		let equalsIndex = nameStart;

		// scan the name, ending at "=" (61) or at the pair boundary
		while (equalsIndex < end && header.charCodeAt(equalsIndex) !== 61) {
			equalsIndex++;
		}

		// ignore pairs without an "=" of their own
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

				// optional whitespace is not part of the value either
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

				cookies[header.substring(nameStart, nameEnd)] =
					header.substring(valueStart, valueEnd);
			}
		}

		// skip the ";"
		start = end + 1;
	}

	return cookies;
};
