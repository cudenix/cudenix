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
		const sep = header.indexOf("; ", start);
		const end = sep === -1 ? length : sep;

		let eq = -1;

		for (let i = start; i < end; i++) {
			if (header.charCodeAt(i) === 61) {
				eq = i;

				break;
			}
		}

		if (eq > start) {
			cookies[header.substring(start, eq)] = header.substring(
				eq + 1,
				end,
			);
		}

		if (sep === -1) {
			break;
		}

		start = sep + 2;
	}

	return cookies;
};
