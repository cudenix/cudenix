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

	return charCode === 36 ||
		(charCode >= 40 && charCode <= 43) ||
		charCode === 46 ||
		(charCode >= 91 && charCode <= 93) ||
		charCode === 124
		? `\\${character}`
		: encodeURIComponent(character.toWellFormed());
};

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

	const parts = (
		path.includes("\\") ? path.replaceAll("\\", "/") : path
	).split("/");

	const paramFlags: number[] = [];
	const paramKeys: string[] = [];
	const ranks: number[] = [];
	const restKeys: string[] = [];

	let last = parts.length - 1;

	while (last >= 0 && parts[last] === "") {
		last--;
	}

	let areAllSegmentsOptional = true;
	let segments = "";

	for (let i = 0; i <= last; i++) {
		const part = parts[i]!;
		const partLength = part.length;

		if (partLength === 0) {
			continue;
		}

		const isOptional = part.charCodeAt(partLength - 1) === 63;
		const contentEnd = isOptional ? partLength - 1 : partLength;
		const firstCharCode = part.charCodeAt(0);

		let segment: string;

		if (firstCharCode === 58) {
			paramFlags.push(isOptional ? PARAM_FLAG_OPTIONAL : 0);
			paramKeys.push(part.slice(1, contentEnd));

			ranks.push(PARAM_RANK);

			segment = PARAM_CAPTURE;
		} else if (firstCharCode === 42 && contentEnd === 1) {
			const isTerminal = i === last;

			ranks.push(isTerminal ? TERMINAL_WILDCARD_RANK : WILDCARD_RANK);

			segment = isTerminal ? TERMINAL_WILDCARD : WILDCARD;
		} else if (
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
			ranks.push(STATIC_RANK);

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
		pattern = areAllSegmentsOptional
			? `(?:${segments}|\\/)()`
			: `${segments}()`;
	} else {
		pattern = path.length > 0 ? String.raw`\/()` : "()";
	}

	return { paramFlags, paramKeys, pattern, ranks, restKeys };
};
