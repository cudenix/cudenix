/**
 * @module
 * Compile route-style paths into capture-group patterns.
 */

/**
 * Regex fragment that captures a single named parameter (`:name`).
 *
 * Forbids `/`, whitespace, `?` and `#` to stop the segment from spilling into
 * the next path component or the query string.
 */
const PARAM_CAPTURE = "\\/([^/\\s?#]+)";

/**
 * Regex fragment that captures a rest parameter (`...name`).
 *
 * Greedily consumes one or more slash-delimited segments while still
 * stopping before query and fragment markers.
 */
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";

/**
 * Non-capturing variant of {@link REST_CAPTURE} used for the catch-all `*`
 * segment when no key is exposed to the caller.
 */
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)";

/**
 * Compile a route pattern into a regex source string and the metadata needed
 * to bind matches back to named parameters.
 *
 * Supported segment syntax:
 *
 * - `:name` — required named parameter.
 * - `:name?` — optional named parameter.
 * - `...name` — rest parameter capturing one or more remaining segments.
 * - `...name?` — optional rest parameter.
 * - `*` — wildcard segment, matches one or more segments without capturing.
 * - Any other literal — matched after `RegExp.escape`, so the generated
 *   source may contain escaped code points such as `\\x75`.
 *
 * Optionality is applied after segment parsing; a trailing `?` therefore also
 * makes literal or wildcard segments optional if those forms are used.
 *
 * The function advances segment by segment, using `indexOf("/")` for
 * boundaries and `charCodeAt` comparisons against the relevant ASCII codes
 * (`/` 47, `?` 63, `:` 58, `*` 42, `.` 46) for dispatch. It only creates
 * substrings for captured names and literal segments. The pattern is seeded
 * with an empty `()` capture so each compiled path contributes exactly
 * `1 + paramKeys.length` groups — a fixed count that the offset arithmetic
 * relies on when callers concatenate several patterns into one regex.
 *
 * @param path - Route pattern to compile. Use `/` for the root path.
 * @returns Compiled artefacts:
 *
 * - `paramKeys` — names of every captured `:name` and `...name` segment, in
 *   left-to-right order.
 * - `pattern` — regex source string ready for `new RegExp(pattern)`.
 * - `restKeys` — names of rest parameters only, or `undefined` when the path
 *   contains none.
 * @example
 * ```typescript
 * pathToRegexp("/");
 * // { paramKeys: [], pattern: "()\\/", restKeys: undefined }
 *
 * pathToRegexp("/a/:p1");
 * // { paramKeys: ["p1"], pattern: "()\\/\\x61\\/([^/\\s?#]+)", restKeys: undefined }
 *
 * pathToRegexp("/a/...r1");
 * // { paramKeys: ["r1"], pattern: "()\\/\\x61\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))", restKeys: ["r1"] }
 *
 * pathToRegexp("/a/:p1?");
 * // { paramKeys: ["p1"], pattern: "()\\/\\x61(?:\\/([^/\\s?#]+))?", restKeys: undefined }
 * ```
 */
export const pathToRegexp = (path: string) => {
	if (path === "/") {
		return {
			paramKeys: [],
			pattern: String.raw`()\/`,
			restKeys: undefined as string[] | undefined,
		};
	}

	const length = path.length;
	const paramKeys = [] as string[];

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
