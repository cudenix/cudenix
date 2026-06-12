/**
 * @module
 * Compile route-style path patterns into regular expression sources.
 */

const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)?";

/**
 * Compile a route pattern into a regex source string plus the parameter
 * metadata required to read named captures back from a successful match.
 * Pair it with `new RegExp()` to power URL matching inside a router.
 *
 * Supported segment syntax:
 *
 * - `:name` — required named parameter (one path segment).
 * - `:name?` — optional named parameter.
 * - `...name` — rest parameter capturing one or more segments (literal
 *   segments may still follow it).
 * - `...name?` — optional rest parameter.
 * - `*` — wildcard, matches a `/` followed by zero or more segments without
 *   capturing, mirroring the `/*` semantics of Bun's router (so `/a/*`
 *   accepts `/a/` but not `/a`).
 * - Anything else — matched as a literal (escaped via `RegExp.escape`).
 *
 * A trailing `?` marks any segment optional, not just named ones — `/a?`
 * compiles to an optional literal `a`. A literal `?` cannot be expressed,
 * which costs nothing for URL matching: in a request target a `?` always
 * starts the query string, never a path character.
 *
 * A pattern whose every segment is optional also matches the root path `/`
 * (the bare slash a real request URL always carries), so `/:p1?` answers
 * both `/` and `/v1`.
 *
 * The compiled pattern always opens with an empty `()` capture group — a
 * participation sentinel. When several compiled patterns are joined as `|`
 * alternatives inside one merged regexp, the sentinel of the alternative
 * that fired is the only one defined (`""`), telling the router which route
 * matched; each pattern then contributes exactly `1 + paramKeys.length`
 * groups, so per-route offsets stay computable. For a standalone pattern the
 * sentinel sits at `match[1]` and the `n`-th `paramKeys` entry aligns with
 * `match[n + 2]`.
 *
 * @param path - Route pattern to compile. Use `"/"` to represent the root
 *   path.
 * @returns Compiled artifacts:
 *
 * - `paramKeys` — names of every `:name` and `...name` segment, in
 *   declaration order.
 * - `pattern` — regex source string for `new RegExp(pattern)`.
 * - `restKeys` — names of rest parameters only.
 * @example
 * ```typescript
 * const { paramKeys, pattern } = pathToRegexp("/a/:p1");
 * const regex = new RegExp(`^${pattern}$`);
 * const match = regex.exec("/a/v1");
 *
 * if (match) {
 *   const params = Object.fromEntries(
 *     paramKeys.map((key, i) => [key, match[i + 2]]),
 *   );
 *   // params === { p1: "v1" }
 * }
 * ```
 */
export const pathToRegexp = (path: string) => {
	if (path === "/") {
		return { paramKeys: [], pattern: String.raw`()\/`, restKeys: [] };
	}

	const length = path.length;
	const paramKeys: string[] = [];
	const restKeys: string[] = [];

	let allOptional = true;
	let segments = "";
	let i = 0;

	while (i < length) {
		if (path.charCodeAt(i) === 47) {
			i++;

			continue;
		}

		let segEnd = path.indexOf("/", i);

		if (segEnd === -1) {
			segEnd = length;
		}

		const isOptional = path.charCodeAt(segEnd - 1) === 63;
		const end = isOptional ? segEnd - 1 : segEnd;
		const first = path.charCodeAt(i);

		let segment: string;

		if (first === 58) {
			paramKeys.push(path.substring(i + 1, end));

			segment = PARAM_CAPTURE;
		} else if (first === 42 && end - i === 1) {
			segment = WILDCARD;
		} else if (
			first === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			const name = path.substring(i + 3, end);

			paramKeys.push(name);

			restKeys.push(name);

			segment = REST_CAPTURE;
		} else {
			segment = `\\/${RegExp.escape(path.substring(i, end))}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		} else {
			allOptional = false;
		}

		segments += segment;

		i = segEnd;
	}

	return {
		paramKeys,
		pattern:
			allOptional && segments ? `()(?:${segments}|\\/)` : `()${segments}`,
		restKeys,
	};
};
