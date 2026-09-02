import { isAsync } from "@/utils/functions/is-async";

/**
 * Matches function sources declared with an empty parameter list.
 */
const EMPTY_PARAMETERS =
	/^\s*(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*\)/;

/**
 * Captures a plain first parameter name in a list or as a bare arrow parameter.
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
 * Union of the response flags.
 */
const RESPONSE_METADATA =
	RESPONSE_CONTENT | RESPONSE_COOKIES | RESPONSE_HEADERS;

/**
 * Union of every flag.
 */
const CONTEXT_ALL =
	CONTEXT_MEMORY |
	CONTEXT_REQUEST |
	CONTEXT_SERVER |
	CONTEXT_STORE |
	RESPONSE_METADATA;

/**
 * Handler features inferred from its source.
 */
export interface HandlerAnalysis {
	readonly isAsync: boolean;
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
 * A plain first parameter and where reference scanning starts.
 */
interface FirstParameter {
	readonly name: string;
	readonly scanStart: number;
}

/**
 * Detects an ASCII word character (`0-9`, `A-Z`, `_`, `a-z`).
 */
const isWordCharacter = (code: number) =>
	// "0" (48) - "9" (57), "A" (65) - "Z" (90)
	(code >= 48 && code <= 57) ||
	(code >= 65 && code <= 90) ||
	// "_" (95), "a" (97) - "z" (122)
	code === 95 ||
	(code >= 97 && code <= 122);

/**
 * Detects a property-name character: a word character, `$`, or non-ASCII.
 */
const isPropertyCharacter = (code: number) =>
	// "$" (36) or a code unit above DEL (127)
	isWordCharacter(code) || code === 36 || code > 127;

/**
 * Detects whitespace accepted around property access (tab, LF, CR, space).
 */
const isWhitespace = (code: number) =>
	// tab (9), LF (10), CR (13), space (32)
	code === 9 || code === 10 || code === 13 || code === 32;

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
	} else if (
		// "." (46) direct property access
		source.charCodeAt(propertyStart) === 46
	) {
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
 * Reads a plain first parameter from function source.
 */
const getFirstParameter = (source: string) => {
	const match = FIRST_PARAMETER.exec(source);
	const name = match?.[1] ?? match?.[2];

	if (!match || !name) {
		return;
	}

	return { name, scanStart: match[0].length };
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
	let index = source.indexOf(parameter.name, parameter.scanStart);

	while (index !== -1) {
		if (isParameterReference(source, index, parameter.name.length)) {
			return true;
		}

		index = source.indexOf(parameter.name, index + parameter.name.length);
	}

	return false;
};

/**
 * Detects opaque or indirect argument access.
 */
const hasOpaqueSourceAccess = (source: string) =>
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
	hasOpaqueAccess: boolean,
) => {
	if (arity === 0) {
		return !EMPTY_PARAMETERS.test(source) || hasOpaqueAccess;
	}

	return (
		parameter === undefined ||
		hasParameterReference(source, parameter) ||
		hasOpaqueAccess
	);
};

/**
 * Collects directly accessed context fields.
 */
const getPropertyUsage = (source: string, parameter: FirstParameter) => {
	let usage = 0;
	let index = source.indexOf(parameter.name, parameter.scanStart);

	while (index !== -1) {
		if (isParameterReference(source, index, parameter.name.length)) {
			const property = getDirectProperty(
				source,
				index + parameter.name.length,
			);

			switch (property?.name) {
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
export const analyzeHandler = (handler: AnalyzableHandler): HandlerAnalysis => {
	const cachedAnalysis = handlerAnalysisCache.get(handler);

	if (cachedAnalysis) {
		return cachedAnalysis;
	}

	const source = handler.toString();
	const parameter = getFirstParameter(source);
	const hasOpaqueAccess = hasOpaqueSourceAccess(source);
	const needsContext = needsContextFromSource(
		source,
		handler.length,
		parameter,
		hasOpaqueAccess,
	);

	let propertyUsage = 0;

	if (needsContext) {
		// unnarrowable sources assume every feature
		propertyUsage =
			hasOpaqueAccess || parameter === undefined
				? CONTEXT_ALL
				: getPropertyUsage(source, parameter);
	}

	const analysis = Object.freeze({
		isAsync: isAsync(handler),
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
