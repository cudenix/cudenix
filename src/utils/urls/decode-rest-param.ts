import { decodePathParam } from "@/utils/urls/decode-path-param";

export const decodeRestParam = (value: string): string[] => {
	let end = value.indexOf("/");

	if (end === -1) {
		return [decodePathParam(value)];
	}

	const firstPercentIndex = value.indexOf("%");
	const segments: string[] = [];

	let start = 0;

	if (firstPercentIndex === -1) {
		do {
			segments.push(value.slice(start, end));

			start = end + 1;
			end = value.indexOf("/", start);
		} while (end !== -1);

		segments.push(value.slice(start));

		return segments;
	}

	do {
		const segment = value.slice(start, end);

		segments.push(
			end > firstPercentIndex ? decodePathParam(segment) : segment,
		);

		start = end + 1;
		end = value.indexOf("/", start);
	} while (end !== -1);

	segments.push(decodePathParam(value.slice(start)));

	return segments;
};
