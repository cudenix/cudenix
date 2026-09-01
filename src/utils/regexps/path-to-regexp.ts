// a single segment, captured
const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
// one or more segments, captured as one string
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
// non-capturing, matches zero segments too
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)?";
// the whole remainder of the path
const TERMINAL_WILDCARD = "\\/[^\\s?#]*";

// regexp syntax and url-encoded characters
const STATIC_SEGMENT_SYNTAX = /[^!-~]|["#$()*+.<>?[\\\]^`{|}]/gu;

// characters a url carries percent-encoded
const URL_ENCODED_CHARACTER = /[^!-~]|["#<>?^`{}]/u;

// percent-encodes or escapes a static character
const escapeStaticCharacter = (character: string) =>
	URL_ENCODED_CHARACTER.test(character)
		? encodeURIComponent(character.toWellFormed())
		: `\\${character}`;

/**
 * Checks whether only separators follow a segment.
 */
const isTerminalSegment = (
	path: string,
	segmentEnd: number,
	length: number,
) => {
	for (let i = segmentEnd; i < length; i++) {
		const charCode = path.charCodeAt(i);

		// "/" (47) and "\" (92) open no segment
		if (charCode !== 47 && charCode !== 92) {
			return false;
		}
	}

	return true;
};

// segment ranks, lower matching first
const STATIC_RANK = 0;
const PARAM_RANK = 1;
const WILDCARD_RANK = 2;
const REST_RANK = 3;
// a terminal "*" matches last
const TERMINAL_WILDCARD_RANK = 4;

/**
 * Marks an optional route parameter in `paramFlags`.
 *
 * @example
 * ```typescript
 * pathToRegexp("/a/:p1?").paramFlags; // [PARAM_FLAG_OPTIONAL]
 * ```
 */
export const PARAM_FLAG_OPTIONAL = 1;

/**
 * Marks a rest route parameter in `paramFlags`.
 *
 * @example
 * ```typescript
 * pathToRegexp("/a/...r1").paramFlags; // [PARAM_FLAG_REST]
 * ```
 */
export const PARAM_FLAG_REST = 2;

/**
 * Compiles a route pattern for matching and parameter extraction.
 *
 * @example
 * ```typescript
 * const { paramFlags, paramKeys, pattern, ranks } =
 *   pathToRegexp("/a/:p1");
 * const match = new RegExp(`^${pattern}$`).exec("/a/v1")!;
 *
 * paramKeys; // ["p1"]
 * paramFlags; // [0]
 * ranks; // [0, 1]
 * match[1]; // "v1"
 *
 * pathToRegexp("/a/...r1").restKeys; // ["r1"]
 * ```
 */
export const pathToRegexp = (path: string) => {
	if (path === "/") {
		return {
			paramFlags: [],
			paramKeys: [],
			// the trailing "()" marks which route matched
			pattern: String.raw`\/()`,
			ranks: [],
			restKeys: [],
		};
	}

	const length = path.length;

	const paramFlags: number[] = [];
	const paramKeys: string[] = [];
	const ranks: number[] = [];
	const restKeys: string[] = [];

	let areAllSegmentsOptional = true;
	let segments = "";
	let i = 0;

	while (i < length) {
		const separatorCode = path.charCodeAt(i);

		// "\" (92) opens the same segment as "/" (47)
		if (separatorCode === 47 || separatorCode === 92) {
			i++;

			continue;
		}

		let segmentEnd = path.indexOf("/", i);

		const backslashIndex = path.indexOf("\\", i);

		// whichever separator comes first closes the segment
		if (
			segmentEnd === -1 ||
			(backslashIndex !== -1 && backslashIndex < segmentEnd)
		) {
			segmentEnd = backslashIndex;
		}

		if (segmentEnd === -1) {
			segmentEnd = length;
		}

		// a trailing "?" (63) marks the segment as optional
		const isOptional = path.charCodeAt(segmentEnd - 1) === 63;
		const contentEnd = isOptional ? segmentEnd - 1 : segmentEnd;
		const firstCharCode = path.charCodeAt(i);

		let segment: string;

		// ":" (58) named param
		if (firstCharCode === 58) {
			paramFlags.push(isOptional ? PARAM_FLAG_OPTIONAL : 0);
			paramKeys.push(path.substring(i + 1, contentEnd));

			ranks.push(PARAM_RANK);

			segment = PARAM_CAPTURE;
		} else if (
			// lone "*" (42) wildcard
			firstCharCode === 42 &&
			contentEnd - i === 1
		) {
			const isTerminal = isTerminalSegment(path, segmentEnd, length);

			ranks.push(isTerminal ? TERMINAL_WILDCARD_RANK : WILDCARD_RANK);

			segment = isTerminal ? TERMINAL_WILDCARD : WILDCARD;
		} else if (
			// "..." (46) rest param
			firstCharCode === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			const name = path.substring(i + 3, contentEnd);

			paramFlags.push(
				PARAM_FLAG_REST | (isOptional ? PARAM_FLAG_OPTIONAL : 0),
			);
			paramKeys.push(name);

			ranks.push(REST_RANK);

			restKeys.push(name);

			segment = REST_CAPTURE;
		} else {
			// static segment
			ranks.push(STATIC_RANK);

			// escape regexp syntax and percent-encode
			segment = `\\/${path.substring(i, contentEnd).replace(STATIC_SEGMENT_SYNTAX, escapeStaticCharacter)}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		} else {
			areAllSegmentsOptional = false;
		}

		segments += segment;

		i = segmentEnd;
	}

	let pattern: string;

	if (segments) {
		// fully-optional patterns match the bare "/" too
		pattern = areAllSegmentsOptional
			? `(?:${segments}|\\/)()`
			: `${segments}()`;
	} else {
		// a path of only separators becomes the root
		pattern = length ? String.raw`\/()` : "()";
	}

	return { paramFlags, paramKeys, pattern, ranks, restKeys };
};
