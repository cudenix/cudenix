import { FreezeEmpty } from "@/utils/objects/empty";

const PARAM_CAPTURE = "\\/([^/\\s?#]+)";
const PARAM_NO_CAPTURE = "\\/[^/\\s?#]+";
const REST_CAPTURE = "\\/((?:[^/\\s?#]+/)*(?:[^/\\s?#]+))";
const WILDCARD = "\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)";

interface PathToRegexpOptions {
	capture?: boolean;
}

export const pathToRegexp = (
	path: string,
	{ capture }: PathToRegexpOptions = FreezeEmpty,
) => {
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
			if (capture) {
				paramKeys.push(path.substring(i + 1, end));
			}

			segment = capture ? PARAM_CAPTURE : PARAM_NO_CAPTURE;
		} else if (first === 42 && end - i === 1) {
			segment = WILDCARD;
		} else if (
			first === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			if (capture) {
				const name = path.substring(i + 3, end);

				paramKeys.push(name);

				if (!restKeys) {
					restKeys = [];
				}

				restKeys.push(name);
			}

			segment = capture ? REST_CAPTURE : WILDCARD;
		} else {
			segment = `\\/${RegExp.escape(path.substring(i, end))}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern += segment;

		i = segEnd;
	}

	return {
		paramKeys,
		pattern,
		restKeys,
	};
};
