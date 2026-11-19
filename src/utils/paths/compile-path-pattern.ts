const PARAM_BARE = String.raw`\/[^/\s?#]+`;
const PARAM_CAPTURE = String.raw`\/([^/\s?#]+)`;
const PARAM_FLAG_OPTIONAL = 1;
const PARAM_FLAG_REST = 2;
const PARAM_RANK = 1;

const REST_BARE = String.raw`\/(?:[^/\s?#]+/)*[^/\s?#]+`;
const REST_CAPTURE = String.raw`\/((?:[^/\s?#]+/)*(?:[^/\s?#]+))`;
const REST_RANK = 3;

const STATIC_RANK = 0;
const STATIC_SEGMENT_SYNTAX = /[^!-~]|["#$()*+.<>?[\\\]^`{|}]/gu;

const TERMINAL_WILDCARD = String.raw`\/[^\s?#]*`;
const TERMINAL_WILDCARD_RANK = 4;

const WILDCARD = String.raw`\/(?:[^/\s?#]+/)*(?:[^/\s?#]+)?`;
const WILDCARD_RANK = 2;

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

export const compilePathPattern = (
	path: string,
): {
	bare: string;
	paramFlags: number[];
	paramKeys: string[];
	pattern: string;
	ranks: number[];
} => {
	if (path === "/") {
		return {
			bare: String.raw`\/`,
			paramFlags: [],
			paramKeys: [],
			// the trailing "()" marks which route matched
			pattern: String.raw`\/()`,
			ranks: [],
		};
	}

	const parts = (
		path.includes("\\") ? path.replaceAll("\\", "/") : path
	).split("/");
	const paramFlags: number[] = [];
	const paramKeys: string[] = [];
	const ranks: number[] = [];

	let last = parts.length - 1;

	while (last >= 0 && parts[last] === "") {
		last--;
	}

	let areAllSegmentsOptional = true;
	let bareSegments = "";
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

		let bareSegment: string;
		let segment: string;

		if (firstCharCode === 58) {
			paramFlags.push(isOptional ? PARAM_FLAG_OPTIONAL : 0);
			paramKeys.push(part.slice(1, contentEnd));
			ranks.push(PARAM_RANK);

			bareSegment = PARAM_BARE;
			segment = PARAM_CAPTURE;
		} else if (firstCharCode === 42 && contentEnd === 1) {
			const isTerminal = i === last;

			ranks.push(isTerminal ? TERMINAL_WILDCARD_RANK : WILDCARD_RANK);

			segment = isTerminal ? TERMINAL_WILDCARD : WILDCARD;
			bareSegment = segment;
		} else if (
			firstCharCode === 46 &&
			part.charCodeAt(1) === 46 &&
			part.charCodeAt(2) === 46
		) {
			paramFlags.push(
				PARAM_FLAG_REST + (isOptional ? PARAM_FLAG_OPTIONAL : 0),
			);
			paramKeys.push(part.slice(3, contentEnd));
			ranks.push(REST_RANK);

			bareSegment = REST_BARE;
			segment = REST_CAPTURE;
		} else {
			ranks.push(STATIC_RANK);

			segment = `\\/${(isOptional ? part.slice(0, contentEnd) : part).replaceAll(STATIC_SEGMENT_SYNTAX, escapeStaticCharacter)}`;
			bareSegment = segment;
		}

		if (isOptional) {
			bareSegment = `(?:${bareSegment})?`;
			segment = `(?:${segment})?`;
		} else {
			areAllSegmentsOptional = false;
		}

		bareSegments += bareSegment;
		segments += segment;
	}

	let bare: string;
	let pattern: string;

	if (!segments) {
		bare = path.length > 0 ? String.raw`\/` : "";
		pattern = `${bare}()`;
	} else if (areAllSegmentsOptional) {
		bare = `(?:${bareSegments}|\\/)`;
		pattern = `(?:${segments}|\\/)()`;
	} else {
		bare = bareSegments;
		pattern = `${segments}()`;
	}

	return { bare, paramFlags, paramKeys, pattern, ranks };
};
