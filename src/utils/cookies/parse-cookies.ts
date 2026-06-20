import { Empty } from "@/utils/objects/empty";

/**
 * Parse a `Cookie` request header into a dictionary keyed by cookie name.
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
		let eq = -1;

		while (i < length) {
			const code = header.charCodeAt(i);

			if (code === 61) {
				eq = i;

				i++;

				break;
			}

			if (
				code === 59 &&
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

		if (eq > start) {
			cookies[header.substring(start, eq)] = header.substring(
				eq + 1,
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
