import { Empty } from "@/utils/objects/empty";

/**
 * @module
 * Parse route path parameters out of a successful URL match.
 */

/**
 * Read named path parameters from a successful route `RegExpExecArray` into a
 * dictionary keyed by parameter name. Use it on the request hot path to expand
 * the captures of a compiled route pattern (see `pathToRegexp`) without
 * rebuilding the name/value mapping by hand.
 *
 * - Captures are read in `paramKeys` order starting at `matchOffset + 1`, the
 *   slot after the pattern's leading empty group.
 * - A capture that came back `undefined` (an unmatched optional segment) is
 *   skipped, so its name is absent from the result.
 * - `%xx` escapes are decoded; a value with no `"%"` is taken verbatim.
 * - A rest parameter (its name is listed in `restKeys`) is decoded and then
 *   split on `"/"` into an array of segments; every other parameter stays a
 *   string.
 * - Returns an empty dictionary when there is no match or no parameter keys.
 * - Result is prototype-free (built on {@link Empty}), so names like
 *   `__proto__` are safe to read.
 *
 * @param match - Successful `RegExpExecArray` from the route regex, or
 *   `undefined` when the route did not match.
 * @param paramKeys - Parameter names in declaration order, as produced by
 *   `pathToRegexp`.
 * @param matchOffset - Index of the pattern's leading empty group; the first
 *   parameter capture sits at `matchOffset + 1`.
 * @param restKeys - Subset of `paramKeys` that are rest parameters and should
 *   be split into segment arrays.
 * @returns Dictionary mapping each parameter name to its decoded value; empty
 *   when there is nothing to read.
 * @example
 * ```typescript
 * const a = /^()\/a\/([^/]+)$/.exec("/a/v1")!;
 *
 * parseParams(a, ["p1"], 1, []); // { p1: "v1" }
 *
 * const b = /^()\/a\/(.+)$/.exec("/a/b/c")!;
 *
 * parseParams(b, ["r1"], 1, ["r1"]); // { r1: ["b", "c"] }
 * ```
 */
export const parseParams = (
	match: RegExpExecArray | undefined,
	paramKeys: string[],
	matchOffset: number,
	restKeys: string[],
) => {
	const params = new Empty() as Record<string, string | string[]>;

	if (!match || paramKeys.length === 0) {
		return params;
	}

	const offset = matchOffset + 1;

	for (let i = 0; i < paramKeys.length; i++) {
		const name = paramKeys[i];
		const value = match[offset + i];

		if (name === undefined || value === undefined) {
			continue;
		}

		const decoded =
			value.indexOf("%") === -1 ? value : decodeURIComponent(value);

		if (restKeys.includes(name)) {
			params[name] = decoded.split("/");
		} else {
			params[name] = decoded;
		}
	}

	return params;
};
