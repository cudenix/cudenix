import { decodePathParam } from "@/utils/urls/decode-path-param";

/**
 * Splits a rest route parameter into its decoded segments.
 *
 * @example
 * ```typescript
 * decodeRestParam("a/b%20c"); // ["a", "b c"]
 * ```
 */
export const decodeRestParam = (value: string): string[] => {
	let end = value.indexOf("/");

	// single segment
	if (end === -1) {
		return [decodePathParam(value)];
	}

	const firstPercentIndex = value.indexOf("%");
	const segments: string[] = [];

	let start = 0;

	// no escape, segments copy as they are
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

		// segments before the first escape copy as they are
		segments.push(
			end > firstPercentIndex ? decodePathParam(segment) : segment,
		);

		start = end + 1;
		end = value.indexOf("/", start);
	} while (end !== -1);

	segments.push(decodePathParam(value.slice(start)));

	return segments;
};
