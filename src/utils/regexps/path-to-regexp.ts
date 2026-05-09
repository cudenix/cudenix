import { FreezeEmpty } from "@/utils/objects/empty";

interface PathToRegexpOptions {
	capture?: boolean;
}

export const pathToRegexp = (
	path: string,
	{ capture }: PathToRegexpOptions = FreezeEmpty,
) => {
	if (path === "/") {
		return { paramKeys: [], pattern: String.raw`()\/` };
	}

	const length = path.length;
	const paramKeys = [] as string[];

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
			const name = path.substring(i + 1, end);

			if (capture) {
				paramKeys.push(name);
			}

			segment = `\\/${capture ? "(" : ""}[^/\\s?#]+${capture ? ")" : ""}`;
		} else if (first === 42 && end - i === 1) {
			segment = `\\/(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)`;
		} else if (
			first === 46 &&
			path.charCodeAt(i + 1) === 46 &&
			path.charCodeAt(i + 2) === 46
		) {
			const name = path.substring(i + 3, end);

			if (capture) {
				paramKeys.push(name);
			}

			segment = `\\/${capture ? "(" : ""}(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)${capture ? ")" : ""}`;
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
	};
};
