import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * `Cookie` header parser for semicolon-space separated pairs.
 */

/**
 * Parse the value of a `Cookie` request header into a key/value dictionary.
 *
 * Scans the header with `indexOf`/`charCodeAt` (61 is `=`) instead of
 * `split("; ")`, avoiding the intermediate array of cookie pairs. The
 * delimiter is the exact `"; "` sequence; entries separated by `";"` without
 * the following space stay inside the current value. The first `=` in each
 * entry separates the name from the value, so later `=` characters remain in
 * the value. Entries without an `=` are skipped, entries with an empty name
 * are dropped, and duplicate names keep the last value because each iteration
 * unconditionally writes into the result object.
 *
 * The result is built on top of {@link Empty}.
 *
 * @param header - Raw `Cookie` header value (`"a=1; b=2"`).
 * @returns Dictionary mapping cookie name to its raw, undecoded value.
 *   Returns an empty {@link Empty} instance when the header carries no
 *   parseable pairs.
 * @example
 * ```typescript
 * parseCookies("sid=abc123; theme=dark");
 * // { sid: "abc123", theme: "dark" }
 *
 * parseCookies("flag; sid=abc"); // entries without `=` are ignored
 * // { sid: "abc" }
 *
 * parseCookies("a=1;b=2"); // only `; ` separates entries
 * // { a: "1;b=2" }
 *
 * parseCookies("");
 * // {}
 * ```
 */
export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

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
