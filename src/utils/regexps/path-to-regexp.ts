/**
 * @module
 * Compile route-style path patterns into regular expression sources.
 */

const PARAM_CAPTURE = "\\/([^/\\s?#]+)";

const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";

const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)";

/**
 * Compile a route pattern into a regex source string plus the parameter
 * metadata required to read named captures back from a successful match.
 * Pair it with `new RegExp()` to power URL matching inside a router.
 *
 * Supported segment syntax:
 *
 * - `:name` — required named parameter (one path segment).
 * - `:name?` — optional named parameter.
 * - `...name` — rest parameter capturing one or more remaining segments.
 * - `...name?` — optional rest parameter.
 * - `*` — wildcard, matches one or more segments without capturing.
 * - Anything else — matched as a literal (escaped via `RegExp.escape`).
 *
 * The compiled pattern always opens with an empty `()` capture group, so the
 * `n`-th `paramKeys` entry aligns with `match[n + 2]`. The leading group
 * lets several compiled patterns be concatenated without breaking the offset
 * math.
 *
 * @param path - Route pattern to compile. Pass `"/"` for the root path.
 * @returns Compiled artifacts:
 *
 * - `paramKeys` — names of every `:name` and `...name` segment, in
 *   declaration order.
 * - `pattern` — regex source string for `new RegExp(pattern)`.
 * - `restKeys` — names of rest parameters only, or `undefined` when the
 *   path has none.
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
