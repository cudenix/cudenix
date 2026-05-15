import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * `Cookie` header parser.
 */

/**
 * Parse the value of a `Cookie` request header into a key/value dictionary.
 *
 * Walks the header once with `indexOf`/`charCodeAt` (61 is `=`) instead of
 * the more idiomatic `split("; ")` so no intermediate array is allocated.
 * Entries without an `=` are skipped, entries with a leading `=` are
 * dropped, and duplicate names keep the last value because each iteration
 * unconditionally writes into the result object.
 *
 * The result is built on top of {@link Empty}, so reserved prototype names
 * such as `__proto__` are safe to use as cookie names without leaking onto
 * `Object.prototype`.
 *
 * @param header - Raw `Cookie` header value (`"a=1; b=2"`-shaped).
 * @returns Dictionary mapping cookie name to its raw, undecoded value.
 *   Returns an empty {@link Empty} instance when the header carries no
 *   parseable pairs.
 * @example
 * ```typescript
 * parseCookies("sid=abc123; theme=dark");
 * // { sid: "abc123", theme: "dark" }
 *
 * parseCookies("flag; sid=abc"); // valueless entries are ignored
 * // { sid: "abc" }
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
