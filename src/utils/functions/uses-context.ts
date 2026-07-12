const EMPTY_PARAMETERS =
	/^\s*(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*\)/;

const FIRST_PARAMETER =
	/^\s*(?:(?:async(?=\s|\*)\s*)?(?:function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?|\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)?\(\s*([A-Za-z_]\w*)\s*[,)]|(?:async\s+)?([A-Za-z_]\w*)\s*=>)/;

const verdicts = new WeakMap<(...args: any[]) => unknown, boolean>();

const sourceUsesContext = (source: string) => {
	if (
		source.indexOf("[native code]") !== -1 ||
		source.indexOf("arguments") !== -1 ||
		source.indexOf("eval") !== -1 ||
		source.indexOf("\\u") !== -1
	) {
		return true;
	}

	const match = FIRST_PARAMETER.exec(source);

	if (!match) {
		return !EMPTY_PARAMETERS.test(source);
	}

	const parameter = match[1] ?? match[2];

	return (
		parameter === undefined ||
		new RegExp(`\\b${parameter}\\b`).test(source.slice(match[0].length))
	);
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
	if (fn.length > 0 && typeof fn !== "function") {
		return true;
	}

	let verdict = verdicts.get(fn);

	if (verdict === undefined) {
		if (
			typeof fn === "function" &&
			fn.toString !== Function.prototype.toString
		) {
			verdict = true;
		} else {
			verdict = sourceUsesContext(fn.toString());
		}

		verdicts.set(fn, verdict);
	}

	return verdict;
};
