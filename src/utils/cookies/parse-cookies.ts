import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Parse the `Cookie` request header into a name/value dictionary.
 */

/**
 * Parse a `Cookie` request header into a dictionary keyed by cookie name.
 * Use it inside a request handler to look up cookies without pulling in a
 * heavier library.
 *
 * - Values are returned undecoded — run `decodeURIComponent` at the call
 *   site if needed.
 * - Last write wins when the header lists the same name more than once.
 * - Entries must be split by `"; "` (browser format); a bare `";"` is not a
 *   separator.
 * - Malformed entries (no `=`, empty name) are skipped silently.
 * - Result is prototype-free (built on {@link Empty}), so names like
 *   `__proto__` are safe to read.
 *
 * @param header - Raw value of the `Cookie` request header. Pass an empty
 *   string when the header is missing.
 * @returns Dictionary mapping each cookie name to its raw, undecoded value.
 * @example
 * ```typescript
 * const a = parseCookies("a=v1; b=v2");
 *
 * a.a; // "v1"
 * a.b; // "v2"
 *
 * decodeURIComponent(parseCookies("a=a%20b").a); // "a b"
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
