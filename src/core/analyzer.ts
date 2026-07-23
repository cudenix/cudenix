export interface HandlerAnalysis {
	readonly needsContext: boolean;
	readonly needsMemory: boolean;
	readonly needsRequest: boolean;
	readonly needsResponseContent: boolean;
	readonly needsResponseCookies: boolean;
	readonly needsResponseHeaders: boolean;
	readonly needsResponseMetadata: boolean;
	readonly needsServer: boolean;
	readonly needsStore: boolean;
}

/**
 * Any function whose source can be analyzed.
 */
type AnalyzableHandler = (...args: never[]) => unknown;

/**
 * A plain first parameter and the offset where its body search starts.
 */
interface FirstParameter {
	name: string;
	searchStart: number;
}

/**
 * Matches function sources declared with an empty parameter list.
 */
const EMPTY_PARAMETERS =
	/^\s*(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*\)/;

/**
 * Captures a plain first parameter name: group 1 inside a parameter list,
 * group 2 for a bare arrow parameter.
 */
const FIRST_PARAMETER =
	/^\s*(?:(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*([A-Za-z_]\w*)\s*[,)]|(?:async\s+)?([A-Za-z_]\w*)\s*=>)/;

/**
 * Bit flags for each context feature a handler can access.
 */
const CONTEXT_MEMORY = 1;
const CONTEXT_REQUEST = 2;
const CONTEXT_SERVER = 4;
const CONTEXT_STORE = 8;
const RESPONSE_CONTENT = 16;
const RESPONSE_COOKIES = 32;
const RESPONSE_HEADERS = 64;

/**
 * Union of the response flags; backs `needsResponseMetadata`.
 */
const RESPONSE_METADATA =
	RESPONSE_CONTENT | RESPONSE_COOKIES | RESPONSE_HEADERS;

/**
 * Union of every flag; the pessimistic result when source cannot be narrowed.
 */
const CONTEXT_ALL =
	CONTEXT_MEMORY |
	CONTEXT_REQUEST |
	CONTEXT_SERVER |
	CONTEXT_STORE |
	RESPONSE_METADATA;

/**
 * Detects an ASCII word character (`0-9`, `A-Z`, `_`, `a-z`).
 */
const isWordCharacter = (code: number) =>
	(code >= 48 && code <= 57) ||
	(code >= 65 && code <= 90) ||
	code === 95 ||
	(code >= 97 && code <= 122);

/**
 * Detects a conservative property-name character: a word character, `$`, or
 * anything beyond ASCII.
 */
const isPropertyCharacter = (code: number) =>
	isWordCharacter(code) || code === 36 || code > 127;

/**
 * Detects whitespace accepted around property access (tab, LF, CR, space).
 */
const isWhitespace = (code: number) =>
	code === 9 || code === 10 || code === 13 || code === 32;

/**
 * Reads a plain first parameter from function source.
 */
const getFirstParameter = (source: string) => {
	const match = FIRST_PARAMETER.exec(source);
	const name = match?.[1] ?? match?.[2];

	if (!match || !name) {
		return;
	}

	return { name, searchStart: match[0].length };
};

/**
 * Checks whether an occurrence is a complete parameter reference.
 */
const isParameterReference = (source: string, index: number, length: number) =>
	!isWordCharacter(source.charCodeAt(index - 1)) &&
	!isWordCharacter(source.charCodeAt(index + length));

/**
 * Finds a reference to the first parameter.
 */
const hasParameterReference = (source: string, parameter: FirstParameter) => {
	let index = source.indexOf(parameter.name, parameter.searchStart);

	while (index !== -1) {
		if (isParameterReference(source, index, parameter.name.length)) {
			return true;
		}

		index = source.indexOf(parameter.name, index + parameter.name.length);
	}

	return false;
};

/**
 * Skips whitespace from a source offset.
 */
const skipWhitespace = (source: string, start: number) => {
	let index = start;

	while (isWhitespace(source.charCodeAt(index))) {
		index++;
	}

	return index;
};

/**
 * Reads the property behind a `.` or `?.` access at a source offset.
 */
const getDirectProperty = (source: string, start: number) => {
	let propertyStart = skipWhitespace(source, start);

	if (source.startsWith("?.", propertyStart)) {
		propertyStart += 2;
	} else if (source.charCodeAt(propertyStart) === 46) {
		propertyStart++;
	} else {
		return;
	}

	propertyStart = skipWhitespace(source, propertyStart);

	let propertyEnd = propertyStart;

	while (isPropertyCharacter(source.charCodeAt(propertyEnd))) {
		propertyEnd++;
	}

	if (propertyEnd !== propertyStart) {
		return {
			end: propertyEnd,
			name: source.slice(propertyStart, propertyEnd),
		};
	}
};

/**
 * Collects the directly accessed context fields.
 */
const getPropertyUsage = (source: string, parameter: FirstParameter) => {
	let usage = 0;
	let index = source.indexOf(parameter.name, parameter.searchStart);

	while (index !== -1) {
		if (isParameterReference(source, index, parameter.name.length)) {
			const property = getDirectProperty(
				source,
				index + parameter.name.length,
			);

			switch (property?.name) {
				case "match":
					break;
				case "memory":
					usage |= CONTEXT_MEMORY;

					break;
				case "request":
					usage |= CONTEXT_REQUEST;

					break;
				case "server":
					usage |= CONTEXT_SERVER;

					break;
				case "store":
					usage |= CONTEXT_STORE;

					break;
				case "response": {
					const responseProperty = getDirectProperty(
						source,
						property.end,
					);

					switch (responseProperty?.name) {
						case "content":
							usage |= RESPONSE_CONTENT;

							break;
						case "cookies":
							usage |= RESPONSE_COOKIES;

							break;
						case "headers":
							usage |= RESPONSE_HEADERS;

							break;
						default:
							return CONTEXT_ALL;
					}

					break;
				}
				default:
					return CONTEXT_ALL;
			}
		}

		index = source.indexOf(parameter.name, index + parameter.name.length);
	}

	return usage;
};

/**
 * Detects opaque or indirect argument access.
 */
const hasUnsafeSourceAccess = (source: string) =>
	source.indexOf("[native code]") !== -1 ||
	source.indexOf("arguments") !== -1 ||
	source.indexOf("eval") !== -1 ||
	source.indexOf("\\u") !== -1;

/**
 * Detects whether function source needs context.
 */
const needsContextFromSource = (
	source: string,
	arity: number,
	parameter: FirstParameter | undefined,
	hasUnsafeAccess: boolean,
) => {
	if (arity === 0) {
		return !EMPTY_PARAMETERS.test(source) || hasUnsafeAccess;
	}

	return (
		parameter === undefined ||
		hasParameterReference(source, parameter) ||
		hasUnsafeAccess
	);
};

/**
 * Memoizes analyses by handler identity.
 */
const handlerAnalysisCache = new WeakMap<AnalyzableHandler, HandlerAnalysis>();

/**
 * Analyzes and caches the characteristics of a handler.
 *
 * @example
 * ```typescript
 * const analysis = analyzeHandler((context) => context.store.a);
 *
 * analysis.needsContext; // true
 * analysis.needsStore; // true
 * analysis.needsRequest; // false
 * ```
 */
export const analyzeHandler = (handler: AnalyzableHandler) => {
	let analysis = handlerAnalysisCache.get(handler);

	if (analysis) {
		return analysis;
	}

	const source = handler.toString();
	const parameter = getFirstParameter(source);
	const hasUnsafeAccess = hasUnsafeSourceAccess(source);
	const needsContext = needsContextFromSource(
		source,
		handler.length,
		parameter,
		hasUnsafeAccess,
	);
	const propertyUsage = !needsContext
		? 0
		: hasUnsafeAccess || parameter === undefined
			? CONTEXT_ALL
			: getPropertyUsage(source, parameter);

	analysis = Object.freeze({
		needsContext,
		needsMemory: (propertyUsage & CONTEXT_MEMORY) !== 0,
		needsRequest: (propertyUsage & CONTEXT_REQUEST) !== 0,
		needsResponseContent: (propertyUsage & RESPONSE_CONTENT) !== 0,
		needsResponseCookies: (propertyUsage & RESPONSE_COOKIES) !== 0,
		needsResponseHeaders: (propertyUsage & RESPONSE_HEADERS) !== 0,
		needsResponseMetadata: (propertyUsage & RESPONSE_METADATA) !== 0,
		needsServer: (propertyUsage & CONTEXT_SERVER) !== 0,
		needsStore: (propertyUsage & CONTEXT_STORE) !== 0,
	});

	handlerAnalysisCache.set(handler, analysis);

	return analysis;
};
