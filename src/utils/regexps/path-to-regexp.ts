const PARAM_CAPTURE = String.raw`\/([^/\s?#]+)`;
const REST_CAPTURE = String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))`;
const WILDCARD = String.raw`\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?`;
const TERMINAL_WILDCARD = String.raw`\/[^\s?#]*`;
const STATIC_SEGMENT_SYNTAX = /[^!-~]|["#$()*+.<>?[\\\]^`{|}]/gu;
const STATIC_RANK = 0;
const PARAM_RANK = 1;
const WILDCARD_RANK = 2;
const REST_RANK = 3;
const TERMINAL_WILDCARD_RANK = 4;
const PARAM_FLAG_OPTIONAL = 1;
const PARAM_FLAG_REST = 2;

const escapeStaticCharacter = (character: string): string => {
	const charCode = character.charCodeAt(0);

	// "$" (36), "(" to "+" (40-43), "." (46), "[" to "]" (91-93), "|" (124)
	return charCode === 36 ||
		(charCode >= 40 && charCode <= 43) ||
		charCode === 46 ||
		(charCode >= 91 && charCode <= 93) ||
		charCode === 124
		? `\\${character}`
		: encodeURIComponent(character.toWellFormed());
};

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
export const pathToRegexp = (
	path: string,
): {
	paramFlags: number[];
	paramKeys: string[];
	pattern: string;
	ranks: number[];
	restKeys: string[];
} => {
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

	const paramFlags: number[] = [];
	const paramKeys: string[] = [];
	const ranks: number[] = [];
	const restKeys: string[] = [];

	// "\" separates like "/"
	const parts = (
		path.includes("\\") ? path.replaceAll("\\", "/") : path
	).split("/");

	let last = parts.length - 1;

	// the last part that holds a segment
	while (last >= 0 && parts[last] === "") {
		last--;
	}

	let areAllSegmentsOptional = true;
	let segments = "";

	for (let i = 0; i <= last; i++) {
		const part = parts[i]!;
		const partLength = part.length;

		// separator runs leave empty parts
		if (partLength === 0) {
			continue;
		}

		// a trailing "?" (63) marks the segment as optional
		const isOptional = part.charCodeAt(partLength - 1) === 63;
		const contentEnd = isOptional ? partLength - 1 : partLength;
		const firstCharCode = part.charCodeAt(0);

		let segment: string;

		// ":" (58) named param
		if (firstCharCode === 58) {
			paramFlags.push(isOptional ? PARAM_FLAG_OPTIONAL : 0);
			paramKeys.push(part.slice(1, contentEnd));

			ranks.push(PARAM_RANK);

			segment = PARAM_CAPTURE;
		} else if (
			// lone "*" (42) wildcard
			firstCharCode === 42 &&
			contentEnd === 1
		) {
			// only separators follow the last part
			const isTerminal = i === last;

			ranks.push(isTerminal ? TERMINAL_WILDCARD_RANK : WILDCARD_RANK);

			segment = isTerminal ? TERMINAL_WILDCARD : WILDCARD;
		} else if (
			// "..." (46) rest param
			firstCharCode === 46 &&
			part.charCodeAt(1) === 46 &&
			part.charCodeAt(2) === 46
		) {
			const name = part.slice(3, contentEnd);

			paramFlags.push(
				PARAM_FLAG_REST + (isOptional ? PARAM_FLAG_OPTIONAL : 0),
			);
			paramKeys.push(name);

			ranks.push(REST_RANK);

			restKeys.push(name);

			segment = REST_CAPTURE;
		} else {
			// static segment
			ranks.push(STATIC_RANK);

			// escape regexp syntax and percent-encode
			segment = `\\/${(isOptional ? part.slice(0, contentEnd) : part).replaceAll(STATIC_SEGMENT_SYNTAX, escapeStaticCharacter)}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		} else {
			areAllSegmentsOptional = false;
		}

		segments += segment;
	}

	let pattern: string;

	if (segments) {
		// fully-optional patterns match the bare "/" too
		pattern = areAllSegmentsOptional
			? `(?:${segments}|\\/)()`
			: `${segments}()`;
	} else {
		// a path of only separators becomes the root
		pattern = path.length > 0 ? String.raw`\/()` : "()";
	}

	return { paramFlags, paramKeys, pattern, ranks, restKeys };
};
