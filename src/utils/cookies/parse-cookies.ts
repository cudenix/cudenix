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
		let i = start;
		let equalsIndex = -1;

		while (i < length) {
			const charCode = header.charCodeAt(i);

			if (charCode === 61) {
				equalsIndex = i;

				i++;

				break;
			}

			if (
				charCode === 59 &&
				i + 1 < length &&
				header.charCodeAt(i + 1) === 32
			) {
				break;
			}

			i++;
		}

		while (i < length) {
			if (
				header.charCodeAt(i) === 59 &&
				i + 1 < length &&
				header.charCodeAt(i + 1) === 32
			) {
				break;
			}

			i++;
		}

		const end = i;

		if (equalsIndex > start) {
			cookies[header.substring(start, equalsIndex)] = header.substring(
				equalsIndex + 1,
				end,
			);
		}

		if (i >= length) {
			break;
		}

		start = i + 2;
	}

	return cookies;
};
