export interface PathToRegexpOptions {
	captureParamGroups?: boolean;
}

export const pathToRegexp = (
	path: string,
	{ captureParamGroups = false }: PathToRegexpOptions = {},
) => {
	if (path === "/") {
		return "()\\/";
	}

	let pattern = "()";

	const segments = path.split("/");

	for (let i = 0; i < segments.length; i++) {
		let segment = segments[i];

		if (!segment) {
			continue;
		}

		const isOptional = segment.endsWith("?");

		if (isOptional) {
			segment = segment.slice(0, -1);
		}

		if (segment.startsWith(":")) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(1)}>` : ""}[^/\\s?#]+${captureParamGroups ? ")" : ""}`;
		} else if (segment.startsWith("...")) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(3)}>` : ""}(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)${captureParamGroups ? ")" : ""}`;
		} else {
			segment = `\\/${RegExp.escape(segment)}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern += segment;
	}

	return pattern;
};
