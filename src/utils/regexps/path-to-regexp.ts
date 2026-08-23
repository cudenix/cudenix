// a single segment, captured
const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
// one or more "/"-separated segments, captured as one string
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
// same shape as rest but non-capturing, and matches zero segments too
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)?";
// a terminal "*" is the only wildcard Bun's router accepts, and it swallows
// the whole remainder of the path, empty segments and a trailing "/" included,
// so one greedy run mirrors it and leaves nothing to backtrack over
const TERMINAL_WILDCARD = "\\/[^\\s?#]*";

// regexp syntax, plus every character a url pathname carries percent-encoded
const STATIC_SEGMENT_SYNTAX = /[^!-~]|["#$()*+.<>?[\\\]^`{|}]/gu;

// the url parser percent-encodes these, so a request url never holds them
// literally and a pattern that did could not match one
const URL_ENCODED_CHARACTER = /[^!-~]|["#<>?^`{}]/u;

// percent-encodes what a request url carries encoded and escapes the rest,
// "toWellFormed" standing in for the parser's own lone surrogate replacement
const escapeStaticCharacter = (character: string) =>
	URL_ENCODED_CHARACTER.test(character)
		? encodeURIComponent(character.toWellFormed())
		: `\\${character}`;

/**
 * Checks whether nothing but "/" separators follows a segment.
 */
const isTerminalSegment = (
	path: string,
	segmentEnd: number,
	length: number,
) => {
	for (let i = segmentEnd; i < length; i++) {
		// "/" (47) separators open no segment of their own
		if (path.charCodeAt(i) !== 47) {
			return false;
		}
	}

	return true;
};

// segment specificity used to order routes: lower ranks match first
const STATIC_RANK = 0;
const PARAM_RANK = 1;
const WILDCARD_RANK = 2;
const REST_RANK = 3;

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
		// skip "/" (47) separators
		if (path.charCodeAt(i) === 47) {
			i++;

			continue;
		}

		let segmentEnd = path.indexOf("/", i);

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
			ranks.push(WILDCARD_RANK);

			segment = isTerminalSegment(path, segmentEnd, length)
				? TERMINAL_WILDCARD
				: WILDCARD;
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

			// escape regexp syntax and percent-encode what a url would
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
		// fully-optional patterns also match the bare "/" path
		pattern = areAllSegmentsOptional
			? `(?:${segments}|\\/)()`
			: `${segments}()`;
	} else {
		// a path of nothing but separators normalizes to the root
		pattern = length ? String.raw`\/()` : "()";
	}

	return { paramFlags, paramKeys, pattern, ranks, restKeys };
};
