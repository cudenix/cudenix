const EMPTY_PARAMETERS = /^\s*(?:async\s+)?(?:function\b[^(]*)?\(\s*\)/;

const verdicts = new WeakMap<(...args: any[]) => unknown, boolean>();

/**
 * Detects whether a function accesses the request context.
 *
 * @example
 * ```typescript
 * usesContext(() => {}); // false
 * usesContext((context) => context.store); // true
 * usesContext(function () { return arguments[0]; }); // true
 * usesContext((...args) => args[0]); // true
 * ```
 */
export const usesContext = (fn: (...args: any[]) => unknown) => {
	if (fn.length > 0) {
		return true;
	}

	let verdict = verdicts.get(fn);

	if (verdict === undefined) {
		const source = fn.toString();

		verdict =
			source.indexOf("[native code]") !== -1 ||
			source.indexOf("arguments") !== -1 ||
			!EMPTY_PARAMETERS.test(source);

		verdicts.set(fn, verdict);
	}

	return verdict;
};
