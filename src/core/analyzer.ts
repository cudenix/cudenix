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
 * Matches opaque or indirect argument access.
 */
const OPAQUE_ACCESS = /\[native code\]|arguments|eval|\\u/;

/**
 * A property-name character: a word character, `$`, or a code unit above DEL.
 */
const PROPERTY_CHARACTER = "[\\w$\\u0080-\\uffff]";

/**
 * A `.` or `?.` access surrounded by tab, LF, CR, or space.
 */
const PROPERTY_ACCESS = "[\\t\\n\\r ]*(?:\\?\\.|\\.)[\\t\\n\\r ]*";

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
 * Flag set once the first parameter is referenced at all.
 */
const PARAMETER_REFERENCED = 128;

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
 * Reads a plain first parameter from function source.
 */
const getFirstParameter = (source: string): FirstParameter | undefined => {
	const match = FIRST_PARAMETER.exec(source);
	const name = match?.[1] ?? match?.[2];

	if (!match || !name) {
		return;
	}

	return { name, scanStart: match[0].length };
};

/**
 * Memoizes the reference matcher of each parameter name.
 */
const referenceMatchers = new Map<string, RegExp>();

/**
 * Builds the matcher of a parameter reference and the context field behind it.
 */
const getReferenceMatcher = (name: string) => {
	let matcher = referenceMatchers.get(name);

	if (!matcher) {
		// group 1 is a direct field, group 2 `response`, group 3 its field
		matcher = new RegExp(
			`(?<![0-9A-Za-z_])${name}(?![0-9A-Za-z_])(?:${PROPERTY_ACCESS}(?:(memory|request|server|store)(?!${PROPERTY_CHARACTER})|(response)(?!${PROPERTY_CHARACTER})(?:${PROPERTY_ACCESS}(content|cookies|headers)(?!${PROPERTY_CHARACTER}))?|${PROPERTY_CHARACTER}+))?`,
			"g",
		);

		referenceMatchers.set(name, matcher);
	}

	return matcher;
};

/**
 * Collects the context fields accessed through the first parameter.
 */
const getPropertyUsage = (source: string, parameter: FirstParameter) => {
	const matcher = getReferenceMatcher(parameter.name);

	matcher.lastIndex = parameter.scanStart;

	let usage = 0;
	let match = matcher.exec(source);

	while (match !== null) {
		const field = match[1];
		const responseField = match[3];

		if (field !== undefined) {
			usage |=
				field === "memory"
					? CONTEXT_MEMORY
					: field === "request"
						? CONTEXT_REQUEST
						: field === "server"
							? CONTEXT_SERVER
							: CONTEXT_STORE;
		} else if (responseField !== undefined) {
			usage |=
				responseField === "content"
					? RESPONSE_CONTENT
					: responseField === "cookies"
						? RESPONSE_COOKIES
						: RESPONSE_HEADERS;
		} else {
			// an escaping or unknown access assumes every feature
			return CONTEXT_ALL | PARAMETER_REFERENCED;
		}

		usage |= PARAMETER_REFERENCED;
		match = matcher.exec(source);
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
	const hasOpaqueAccess = OPAQUE_ACCESS.test(source);
	// unnarrowable sources assume every feature
	const usage =
		hasOpaqueAccess || parameter === undefined
			? CONTEXT_ALL | PARAMETER_REFERENCED
			: getPropertyUsage(source, parameter);
	// a zero-arity handler needs context unless its source declares no parameter
	const needsContext =
		handler.length === 0
			? !EMPTY_PARAMETERS.test(source) || hasOpaqueAccess
			: (usage & PARAMETER_REFERENCED) !== 0;
	const propertyUsage = needsContext ? usage & CONTEXT_ALL : 0;

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
