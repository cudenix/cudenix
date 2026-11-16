import { parseUrlencoded } from "@/utils/urls/parse-urlencoded";

export const parseQuery = (url: string): Record<string, unknown> => {
	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return {};
	}

	const hashIndex = url.indexOf("#");

	return parseUrlencoded(
		url,
		queryIndex + 1,
		hashIndex === -1 ? url.length : hashIndex,
		true,
	);
};
