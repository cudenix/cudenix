const ASYNC_FUNCTION_PROTOTYPE = Object.getPrototypeOf(async () => {});

/**
 * Detects asynchronous functions.
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
