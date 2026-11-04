import { decodePathParam } from "@/utils/urls/decode-path-param";

/**
 * Splits a rest route parameter into its decoded segments.
 *
 * @example
 * ```typescript
 * decodeRestParam("a/b%20c"); // ["a", "b c"]
 * ```
 */
export const decodeRestParam = (value: string): string[] =>
	// only an escaped value needs decoding
	value.includes("%")
		? value.split("/").map((segment) => decodePathParam(segment))
		: value.split("/");
