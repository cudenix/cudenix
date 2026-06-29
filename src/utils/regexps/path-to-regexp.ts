const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)?";

/**
 * Compile a route pattern into a regex source plus its parameter names.
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

	let areAllSegmentsOptional = true;
	let segments = "";
	let i = 0;

	while (i < length) {
		if (path.charCodeAt(i) === 47) {
			i++;

			continue;
		}

		let segmentEnd = path.indexOf("/", i);

		if (segmentEnd === -1) {
			segmentEnd = length;
		}

		const isOptional = path.charCodeAt(segmentEnd - 1) === 63;
		const end = isOptional ? segmentEnd - 1 : segmentEnd;
		const firstCharCode = path.charCodeAt(i);

		let segment: string;

		if (firstCharCode === 58) {
			paramKeys.push(path.substring(i + 1, end));

			segment = PARAM_CAPTURE;
		} else if (firstCharCode === 42 && end - i === 1) {
			segment = WILDCARD;
		} else if (
			firstCharCode === 46 &&
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
			areAllSegmentsOptional = false;
		}

		segments += segment;

		i = segmentEnd;
	}

	return {
		paramKeys,
		pattern:
			areAllSegmentsOptional && segments
				? `()(?:${segments}|\\/)`
				: `()${segments}`,
		restKeys,
	};
};
