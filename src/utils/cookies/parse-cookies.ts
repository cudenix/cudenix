import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Parse the `Cookie` request header into a name/value dictionary.
 *
 * Use {@link parseCookies} when you need to read individual cookies out of
 * an incoming request without pulling in a heavier cookie library.
 */

/**
 * Parse a `Cookie` request header into a dictionary keyed by cookie name.
 *
 * Reach for this inside a request handler when you need a quick lookup of
 * cookies by name. The function takes the raw header value and returns a
 * plain dictionary you can index into with the names you care about.
 *
 * Behavior worth knowing before you call it:
 *
 * - **No decoding** — values are returned exactly as they appear in the
 *   header. If your cookies are URL-encoded, run `decodeURIComponent` on
 *   the value yourself after lookup.
 * - **Last write wins** — when the header lists the same name more than
 *   once, only the final occurrence is kept in the result.
 * - **Strict `"; "` separator** — entries must be split by a semicolon
 *   followed by a space, which is what browsers send. A bare `";"` is not
 *   treated as a separator, so anything after it stays attached to the
 *   previous value.
 * - **Malformed entries are dropped** — pairs that lack an `=`, or whose
 *   name is empty, are skipped silently instead of throwing.
 * - **Later `=` characters stay in the value** — only the first `=` in
 *   each entry separates the name from the value, so values that contain
 *   `=` round-trip intact.
 * - **Prototype-free result** — the returned dictionary is built on
 *   {@link Empty}, so cookie names like `toString` or `__proto__` are safe
 *   to read without colliding with `Object.prototype` members.
 *
 * @param header - Raw value of the `Cookie` request header, e.g.
 *   `"a=v1; b=v2"`. Pass an empty string when the header is missing from
 *   the request.
 * @returns Dictionary mapping each cookie name to its raw, undecoded value.
 *   Empty when the header carries no parseable pairs.
 * @example
 * Read a couple of cookies out of an incoming request.
 * ```typescript
 * const a = parseCookies("a=v1; b=v2");
 *
 * a.a; // "v1"
 * a.b; // "v2"
 * ```
 * @example
 * Values are returned undecoded — decode them at the call site when needed.
 * ```typescript
 * const a = parseCookies("a=a%20b%3Dc");
 *
 * decodeURIComponent(a.a); // "a b=c"
 * ```
 * @example
 * Malformed or value-only entries are skipped without throwing, and an
 * empty header produces an empty dictionary.
 * ```typescript
 * parseCookies("flag; a=v1");
 * // { a: "v1" }
 *
 * parseCookies("");
 * // {}
 * ```
 * @example
 * Only `"; "` separates entries; a bare `";"` stays inside the value.
 * ```typescript
 * parseCookies("a=1;b=2");
 * // { a: "1;b=2" }
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
