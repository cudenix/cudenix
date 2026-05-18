/**
 * @module
 * Generator-function detector.
 */

/**
 * Cached prototype of synchronous generator functions (`function*`).
 *
 * Captured once at module load so the runtime check is a single reference
 * comparison instead of a `toString` or constructor-name probe.
 */
const GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(function* () {});

/**
 * Cached prototype of asynchronous generator functions (`async function*`).
 *
 * See {@link GENERATOR_FUNCTION_PROTOTYPE} for the rationale behind caching.
 */
const ASYNC_GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(
	async function* () {},
);

/**
 * Check whether `fn` is a generator function — sync or async.
 *
 * The test compares the function object's prototype against the cached
 * generator-function prototypes, so it is robust against bundlers that rename
 * functions and does not rely on `fn.constructor.name`.
 *
 * @param fn - Function to inspect.
 * @returns `true` if `fn` was created as a `function*` or `async function*`,
 *   otherwise `false`.
 * @example
 * ```typescript
 * isGenerator(function* () {}); // true
 * isGenerator(async function* () {}); // true
 * isGenerator(async () => {}); // false
 * isGenerator(() => {}); // false
 * ```
 */
export const isGenerator = (fn: (...args: any[]) => unknown) => {
	const prototype = Object.getPrototypeOf(fn);

	return (
		prototype === GENERATOR_FUNCTION_PROTOTYPE ||
		prototype === ASYNC_GENERATOR_FUNCTION_PROTOTYPE
	);
};
