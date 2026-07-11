const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)?";

const REGEXP_SYNTAX = /[\\^$.*+?()[\]{}|]/g;

const STATIC_RANK = 0;
const PARAM_RANK = 1;
const WILDCARD_RANK = 2;
const REST_RANK = 3;

/**
 * Compiles a route pattern for matching and parameter extraction.
 *
 * @example
 * ```typescript
 * const { paramKeys, pattern, ranks } = pathToRegexp("/a/:p1");
 * const match = new RegExp(`^${pattern}$`).exec("/a/v1")!;
 *
 * paramKeys; // ["p1"]
 * ranks; // [0, 1]
 * match[2]; // "v1"
 * ```
 */
export const pathToRegexp = (path: string) => {
	if (path === "/") {
		return {
			paramKeys: [],
			pattern: String.raw`()\/`,
			ranks: [],
			restKeys: [],
		};
	}

	const length = path.length;

	const paramKeys: string[] = [];
	const ranks: number[] = [];
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

			ranks.push(PARAM_RANK);

			segment = PARAM_CAPTURE;
		} else if (firstCharCode === 42 && end - i === 1) {
			ranks.push(WILDCARD_RANK);

			segment = WILDCARD;
		} else if (
			firstCharCode === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			const name = path.substring(i + 3, end);

			paramKeys.push(name);

			ranks.push(REST_RANK);

			restKeys.push(name);

			segment = REST_CAPTURE;
		} else {
			ranks.push(STATIC_RANK);

			segment = `\\/${path.substring(i, end).replace(REGEXP_SYNTAX, "\\$&")}`;
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
		ranks,
		restKeys,
	};
};
