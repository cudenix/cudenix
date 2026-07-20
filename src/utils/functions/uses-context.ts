const EMPTY_PARAMETERS =
	/^\s*(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*\)/;

const FIRST_PARAMETER =
	/^\s*(?:(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*([A-Za-z_]\w*)\s*[,)]|(?:async\s+)?([A-Za-z_]\w*)\s*=>)/;

const RESPONSE_INDEPENDENT_PROPERTIES = new Set([
	"match",
	"memory",
	"request",
	"server",
	"store",
]);

interface ContextUsage {
	needsContext: boolean;
	needsResponseMetadata: boolean;
}

interface FirstParameter {
	name: string;
	searchStart: number;
}

const contextUsageCache = new WeakMap<
	(...args: any[]) => unknown,
	ContextUsage
>();

/**
 * Detects opaque or indirect argument access.
 */
const hasUnsafeSourceAccess = (source: string) =>
	source.indexOf("[native code]") !== -1 ||
	source.indexOf("arguments") !== -1 ||
	source.indexOf("eval") !== -1 ||
	source.indexOf("\\u") !== -1;

/**
 * Detects an ASCII word character.
 */
const isWordCharacter = (code: number) =>
	(code >= 48 && code <= 57) ||
	(code >= 65 && code <= 90) ||
	code === 95 ||
	(code >= 97 && code <= 122);

/**
 * Detects a conservative property-name character.
 */
const isPropertyCharacter = (code: number) =>
	isWordCharacter(code) || code === 36 || code > 127;

/**
 * Detects whitespace accepted around property access.
 */
const isWhitespace = (code: number) =>
	code === 9 || code === 10 || code === 13 || code === 32;

/**
 * Reads a plain first parameter from function source.
 */
const getFirstParameter = (source: string): FirstParameter | undefined => {
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
 * Reads the direct property following a context reference.
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
		return source.slice(propertyStart, propertyEnd);
	}
};

/**
 * Checks that every context reference targets a safe property.
 */
const hasOnlyMetadataIndependentAccess = (
	source: string,
	parameter: FirstParameter,
) => {
	let index = source.indexOf(parameter.name, parameter.searchStart);

	while (index !== -1) {
		if (isParameterReference(source, index, parameter.name.length)) {
			const property = getDirectProperty(
				source,
				index + parameter.name.length,
			);

			if (
				property === undefined ||
				!RESPONSE_INDEPENDENT_PROPERTIES.has(property)
			) {
				return false;
			}
		}

		index = source.indexOf(parameter.name, index + parameter.name.length);
	}

	return true;
};

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
 * Analyzes and caches a function's context requirements.
 */
const getContextUsage = (fn: (...args: any[]) => unknown): ContextUsage => {
	let usage = contextUsageCache.get(fn);

	if (usage) {
		return usage;
	}

	const source = fn.toString();
	const parameter = getFirstParameter(source);
	const hasUnsafeAccess = hasUnsafeSourceAccess(source);
	const needsContext = needsContextFromSource(
		source,
		fn.length,
		parameter,
		hasUnsafeAccess,
	);
	const needsResponseMetadata =
		needsContext &&
		(hasUnsafeAccess ||
			parameter === undefined ||
			!hasOnlyMetadataIndependentAccess(source, parameter));

	usage = { needsContext, needsResponseMetadata };

	contextUsageCache.set(fn, usage);

	return usage;
};

/**
 * Detects whether a function accesses its context parameter.
 *
 * @example
 * ```typescript
 * usesContext(() => "v1"); // false
 * usesContext((context) => context.store); // true
 * ```
 */
export const usesContext = (fn: (...args: any[]) => unknown) =>
	getContextUsage(fn).needsContext;

/**
 * Detects whether a function requires response metadata.
 *
 * @example
 * ```typescript
 * usesResponseMetadata((context) => context.request.raw); // false
 * usesResponseMetadata((context) => context.response.headers); // true
 * ```
 */
export const usesResponseMetadata = (fn: (...args: any[]) => unknown) =>
	getContextUsage(fn).needsResponseMetadata;
