import { decodePathParam } from "@/utils/urls/decode-path-param";

/**
 * Splits a rest route parameter into its decoded segments.
 *
 * @example
 * ```typescript
 * decodeRestParam("a/b%20c"); // ["a", "b c"]
 * ```
 */
export const decodeRestParam = (value: string) =>
	// nothing to decode, so the segments are the substrings themselves
	value.indexOf("%") === -1
		? value.split("/")
		: value.split("/").map(decodePathParam);
