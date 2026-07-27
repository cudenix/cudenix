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

		const equalsIndex = header.indexOf("=", start);

		// ignore pairs without an "=" of their own
		if (equalsIndex !== -1 && equalsIndex < end) {
			let nameStart = start;
			let nameEnd = equalsIndex;

			// optional whitespace, " " (32) or "\t" (9), is not part of the name
			while (
				nameStart < nameEnd &&
				(header.charCodeAt(nameStart) === 32 ||
					header.charCodeAt(nameStart) === 9)
			) {
				nameStart++;
			}

			while (
				nameEnd > nameStart &&
				(header.charCodeAt(nameEnd - 1) === 32 ||
					header.charCodeAt(nameEnd - 1) === 9)
			) {
				nameEnd--;
			}

			// ignore pairs without a name
			if (nameEnd > nameStart) {
				let valueStart = equalsIndex + 1;
				let valueEnd = end;

				// optional whitespace is not part of the value either
				while (
					valueStart < valueEnd &&
					(header.charCodeAt(valueStart) === 32 ||
						header.charCodeAt(valueStart) === 9)
				) {
					valueStart++;
				}

				while (
					valueEnd > valueStart &&
					(header.charCodeAt(valueEnd - 1) === 32 ||
						header.charCodeAt(valueEnd - 1) === 9)
				) {
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
