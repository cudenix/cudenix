const EMPTY_PARAMETERS =
	/^\s*(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*\)/;

const FIRST_PARAMETER =
	/^\s*(?:(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*([A-Za-z_]\w*)\s*[,)]|(?:async\s+)?([A-Za-z_]\w*)\s*=>)/;

const verdicts = new WeakMap<(...args: any[]) => unknown, boolean>();

/**
 * Detects forms that can reach an argument without a plain identifier.
 */
const hasUnsafeSourceAccess = (source: string) =>
	source.indexOf("[native code]") !== -1 ||
	source.indexOf("arguments") !== -1 ||
	source.indexOf("eval") !== -1 ||
	source.indexOf("\\u") !== -1;

/**
 * Mirrors the ASCII `\w` boundaries previously used by the dynamic RegExp.
 */
const isWordCharacter = (code: number) =>
	(code >= 48 && code <= 57) ||
	(code >= 65 && code <= 90) ||
	code === 95 ||
	(code >= 97 && code <= 122);

const hasParameterReference = (
	source: string,
	parameter: string,
	start: number,
) => {
	let index = source.indexOf(parameter, start);

	while (index !== -1) {
		if (
			!isWordCharacter(source.charCodeAt(index - 1)) &&
			!isWordCharacter(source.charCodeAt(index + parameter.length))
		) {
			return true;
		}

		index = source.indexOf(parameter, index + parameter.length);
	}

	return false;
};

const sourceUsesContext = (source: string, arity: number) => {
	if (arity === 0) {
		return !EMPTY_PARAMETERS.test(source) || hasUnsafeSourceAccess(source);
	}

	const match = FIRST_PARAMETER.exec(source);

	if (!match) {
		return true;
	}

	const parameter = match[1] ?? match[2];

	if (
		parameter === undefined ||
		hasParameterReference(source, parameter, match[0].length)
	) {
		return true;
	}

	return hasUnsafeSourceAccess(source);
};

/**
 * Detects whether a function accesses the request context.
 *
 * @example
 * ```typescript
 * usesContext(() => {}); // false
 * usesContext((_context, next) => next()); // false
 * usesContext((context) => context.store); // true
 * usesContext(function () { return arguments[0]; }); // true
 * usesContext((...args) => args[0]); // true
 * ```
 */
export const usesContext = (fn: (...args: any[]) => unknown) => {
	let verdict = verdicts.get(fn);

	if (verdict === undefined) {
		verdict = sourceUsesContext(fn.toString(), fn.length);

		verdicts.set(fn, verdict);
	}

	return verdict;
};
