import { Empty } from "@/utils/objects/empty";

/**
 * Extracts named parameters from a route match.
 *
 * @example
 * ```typescript
 * const match = /^()\/a\/([^/]+)$/.exec("/a/v1")!;
 *
 * parseParams(match, ["p1"], 1, []); // { p1: "v1" }
 * ```
 */
export const parseParams = (
	match: RegExpExecArray | undefined,
	paramKeys: string[],
	matchOffset: number,
	restKeys: string[],
) => {
	const params = new Empty() as Record<string, string | string[]>;

	if (!match || paramKeys.length === 0) {
		return params;
	}

	// +1 skips the route marker group emitted by pathToRegexp
	const offset = matchOffset + 1;
	const hasRestKeys = restKeys.length > 0;

	for (let i = 0; i < paramKeys.length; i++) {
		const name = paramKeys[i];
		const value = match[offset + i];

		if (name === undefined || value === undefined) {
			continue;
		}

		let decoded = value;

		// keep the raw value on malformed encodings
		if (value.indexOf("%") !== -1) {
			try {
				decoded = decodeURIComponent(value);
			} catch {
				decoded = value;
			}
		}

		// rest params split into their path segments
		if (hasRestKeys && restKeys.indexOf(name) !== -1) {
			params[name] = decoded.split("/");
		} else {
			params[name] = decoded;
		}
	}

	return params;
};
