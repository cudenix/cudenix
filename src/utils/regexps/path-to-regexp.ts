/**
 * @module
 * Compile route-style path patterns into regular expression sources.
 *
 * Use {@link pathToRegexp} to turn a path like `/a/:p1` into a regex
 * source plus the parameter metadata you need to extract named values from a
 * match. Pair it with `new RegExp()` to power URL matching inside a router.
 */

/**
 * Regex fragment that captures a single required path segment.
 *
 * Backs the `:name` syntax in {@link pathToRegexp}. The capture excludes `/`,
 * whitespace, `?`, and `#`, so it never bleeds into the next segment or into
 * the URL's query/fragment.
 */
const PARAM_CAPTURE = "\\/([^/\\s?#]+)";

/**
 * Regex fragment that captures one or more path segments greedily.
 *
 * Backs the `...name` syntax in {@link pathToRegexp}. The match spans every
 * remaining segment but still stops short of the query string and fragment.
 */
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";

/**
 * Non-capturing counterpart to {@link REST_CAPTURE}.
 *
 * Backs the wildcard `*` syntax in {@link pathToRegexp}: use it when you need
 * to allow extra segments but do not care to extract them.
 */
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)";

/**
 * Compile a route pattern into a regex source string plus the parameter
 * metadata required to read named captures back from a successful match.
 *
 * Use this to translate framework-style routes (`/a/:p1`,
 * `/a/...r1`) into a `RegExp` you can run against incoming URLs. The
 * returned `paramKeys` line up with the regex capture groups so you can build
 * a `Record<string, string>` of parameters after calling `regex.exec(url)`.
 *
 * Supported segment syntax:
 *
 * - `:name` — required named parameter, captures one path segment.
 * - `:name?` — optional named parameter.
 * - `...name` — rest parameter capturing one or more remaining segments.
 * - `...name?` — optional rest parameter.
 * - `*` — wildcard segment, matches one or more segments without capturing.
 * - Anything else — matched as a literal (escaped via `RegExp.escape`, so
 *   special characters in the path are safe to use).
 *
 * A trailing `?` on any segment makes that segment optional.
 *
 * The compiled pattern always opens with an empty `()` capture group, so the
 * total capture count is always `1 + paramKeys.length`. This makes it safe to
 * concatenate several compiled patterns into one regex without breaking the
 * offset math that maps capture groups back to parameter names.
 *
 * @param path - Route pattern to compile. Pass `"/"` for the root path.
 * @returns Compiled artifacts ready to plug into a router:
 *
 * - `paramKeys` — names of every `:name` and `...name` segment, in
 *   left-to-right order. The `n`-th name aligns with `match[n + 2]` because
 *   the pattern opens with an empty `()` group at `match[1]`.
 * - `pattern` — regex source string. Wrap it with `new RegExp(pattern)` to
 *   run it against URLs.
 * - `restKeys` — names of rest parameters only, or `undefined` when the
 *   path has none. Use it to detect which extracted values should be split
 *   on `/` to recover the original segment list.
 * @example
 * Match a path with a named parameter.
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
 * @example
 * A rest parameter captures the tail of the path.
 * ```typescript
 * pathToRegexp("/a/...r1");
 * // {
 * //   paramKeys: ["r1"],
 * //   pattern: "()\\/\\x61\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))",
 * //   restKeys: ["r1"],
 * // }
 * ```
 * @example
 * An optional segment matches both `/a` and `/a/v1`.
 * ```typescript
 * pathToRegexp("/a/:p1?");
 * ```
 */
export const pathToRegexp = (path: string) => {
	if (path === "/") {
		return {
			paramKeys: [],
			pattern: String.raw`()\/`,
			restKeys: undefined,
		};
	}

	const length = path.length;
	const paramKeys: string[] = [];

	let restKeys: string[] | undefined;
	let pattern = "()";
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

			if (!restKeys) {
				restKeys = [];
			}

			restKeys.push(name);

			segment = REST_CAPTURE;
		} else {
			segment = `\\/${RegExp.escape(path.substring(i, end))}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern += segment;

		i = segEnd;
	}

	return { paramKeys, pattern, restKeys };
};

console.log(pathToRegexp("/a/...r1"));
