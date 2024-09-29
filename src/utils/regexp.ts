export const endsWithQuestionMarkRegexp = /\?$/;
export const getUrlQueryRegexp = /[?&]([^=#]+)=([^&#]*)/g;
export const startsWithColonRegexp = /^:/;
export const startsWithEllipsisRegexp = /^\.{3}/;
export const useContextBodyRegexp = /\{[^}]*\bbody\b[^}]*\}|\.body\b/m;
export const useContextCookiesRegexp = /\{[^}]*\bcookies\b[^}]*\}|\.cookies\b/m;
export const useContextHeadersRegexp = /\{[^}]*\bheaders\b[^}]*\}|\.headers\b/m;
export const useContextParamsRegexp = /\{[^}]*\bparams\b[^}]*\}|\.params\b/m;
export const useContextQueryRegexp = /\{[^}]*\bquery\b[^}]*\}|\.query\b/m;

export const pathToRegexp = (path: string, captureParamGroups = false) => {
	let pattern = "()";

	if (path === "/") {
		return `${pattern}\\/`;
	}

	const segments = path.split("/");

	for (let i = 0; i < segments.length; i++) {
		let segment = segments[i];

		if (!segment) {
			continue;
		}

		const isOptional = endsWithQuestionMarkRegexp.test(segment);

		if (isOptional) {
			segment = segment.slice(0, -1);
		}

		if (startsWithColonRegexp.test(segment)) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(1)}>` : ""}[^/\\s?#]+${captureParamGroups ? ")" : ""}`;
		} else if (startsWithEllipsisRegexp.test(segment)) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(3)}>` : ""}(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)${captureParamGroups ? ")" : ""}`;
		} else {
			segment = `/${segment}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern = `${pattern}${segment}`;
	}

	return pattern;
};
