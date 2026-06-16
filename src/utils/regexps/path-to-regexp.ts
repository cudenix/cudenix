const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)?";

/**
 * Compile a route pattern into a regex source plus its parameter names. Pair
 * the result with `new RegExp()` to match URLs.
 *
 * @returns `pattern` (regex source), `paramKeys` (parameter names in order),
 * and `restKeys` (the subset that are rest parameters).
 *
 * @example
 * ```typescript
 * const { paramKeys, pattern } = pathToRegexp("/a/:p1");
 * const match = new RegExp(`^${pattern}$`).exec("/a/v1")!;
 *
 * paramKeys; // ["p1"]
 * match[2]; // "v1"
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
