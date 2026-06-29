/** Matches a function source declaring an empty parameter list. */
const EMPTY_PARAMETERS = /^\s*(?:async\s+)?(?:function\b[^(]*)?\(\s*\)/;

/**
 * Check whether `fn` can reach its first argument — the request `Context`.
 * Conservative: only returns `false` when the parameter is provably unreachable,
 * so a handler that does use the context is never starved of it.
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

	const source = fn.toString();

	return (
		source.indexOf("[native code]") !== -1 ||
		source.indexOf("arguments") !== -1 ||
		!EMPTY_PARAMETERS.test(source)
	);
};
