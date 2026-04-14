import { FreezeEmpty } from "@/utils/objects/empty";

interface PathToRegexpOptions {
	captureParamGroups?: boolean;
}

export const pathToRegexp = (
	path: string,
	{ captureParamGroups }: PathToRegexpOptions = FreezeEmpty,
) => {
	if (path === "/") {
		return String.raw`()\/`;
	}

	const { length } = path;

	let pattern = "()";
	let i = 0;

	while (i < length) {
		if (path.charCodeAt(i) === 47) {
			i++;

			continue;
		}

		let segEnd = i;

		while (segEnd < length && path.charCodeAt(segEnd) !== 47) {
			segEnd++;
		}

		const isOptional = path.charCodeAt(segEnd - 1) === 63;

		const end = isOptional ? segEnd - 1 : segEnd;
		const first = path.charCodeAt(i);

		let segment: string;

		if (first === 58) {
			segment = `\\/${captureParamGroups ? `(?<${path.substring(i + 1, end)}>` : ""}[^/\\s?#]+${captureParamGroups ? ")" : ""}`;
		} else if (first === 46 && path.charCodeAt(i + 1) === 46 && path.charCodeAt(i + 2) === 46) {
			segment = `\\/${captureParamGroups ? `(?<${path.substring(i + 3, end)}>` : ""}(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)${captureParamGroups ? ")" : ""}`;
		} else {
			segment = `\\/${RegExp.escape(path.substring(i, end))}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern += segment;

		i = segEnd;
	}

	return pattern;
};
