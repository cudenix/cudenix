const ASYNC_FUNCTION_PROTOTYPE = Object.getPrototypeOf(async () => {});

/**
 * Check whether `fn` is an `async function` — and therefore always returns a
 * promise — as opposed to a plain function, which may still return one. Async
 * generators are excluded: their prototype differs, and {@link isGenerator}
 * already tags both generator forms.
 *
 * @example
 * ```typescript
 * isAsync(async () => {}); // true
 * isAsync(() => {}); // false
 * isAsync(async function* () {}); // false
 * ```
 */
export const isAsync = (fn: (...args: any[]) => unknown) =>
	Object.getPrototypeOf(fn) === ASYNC_FUNCTION_PROTOTYPE;
