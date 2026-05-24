/**
 * @module
 * Runtime detector for generator functions.
 *
 * Use {@link isGenerator} to tell whether a function was declared with
 * `function*` or `async function*` syntax — useful when a route, middleware,
 * or pipeline needs to decide between calling the function directly and
 * driving it with `for..of` / `for await..of`.
 */

/**
 * Cached prototype shared by every synchronous generator function
 * (`function*`).
 *
 * Captured once at module load so {@link isGenerator} can answer with a
 * single reference comparison instead of a slower `toString` or
 * `constructor.name` probe, and so the result survives bundler renames.
 */
const GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(function* () {});

/**
 * Cached prototype shared by every asynchronous generator function
 * (`async function*`).
 *
 * See {@link GENERATOR_FUNCTION_PROTOTYPE} for the rationale behind caching
 * the value at module load.
 */
const ASYNC_GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(
	async function* () {},
);

/**
 * Check whether a function was declared as a generator, covering both
 * synchronous (`function*`) and asynchronous (`async function*`) forms.
 *
 * Reach for this when downstream code needs to branch on handler shape — for
 * example, awaiting a regular handler while consuming a generator handler
 * with `for..of` or `for await..of`. The check is identity-based against
 * cached prototypes, so it stays correct after bundlers rename or minify
 * function names.
 *
 * Behavior worth knowing before you call it:
 *
 * - **Pass the function, not the iterator** — `isGenerator(gen)` is `true`,
 *   but `isGenerator(gen())` is `false`, because invoking a generator
 *   function returns an iterator object, not another generator function.
 * - **Sync and async are not distinguished** — both return `true`. Inspect
 *   `fn.constructor.name` if you need to tell them apart.
 * - **Plain async functions are not generators** — `async () => {}` and
 *   `async function () {}` return promises, so they resolve to `false`.
 *
 * @param fn - Function to inspect.
 * @returns `true` when `fn` was declared with `function*` or
 *   `async function*`, otherwise `false`.
 * @example
 * Tell generator declarations apart from regular and plain async functions.
 * ```typescript
 * isGenerator(function* () {});       // true
 * isGenerator(async function* () {}); // true
 * isGenerator(async () => {});        // false
 * isGenerator(() => {});              // false
 * ```
 * @example
 * Branch on handler shape before invoking it.
 * ```typescript
 * if (isGenerator(handler)) {
 *   for await (const value of handler(input)) {
 *     // ...consume each yielded value
 *   }
 * } else {
 *   await handler(input);
 * }
 * ```
 */
export const isGenerator = (fn: (...args: any[]) => unknown) => {
	const prototype = Object.getPrototypeOf(fn);

	return (
		prototype === GENERATOR_FUNCTION_PROTOTYPE ||
		prototype === ASYNC_GENERATOR_FUNCTION_PROTOTYPE
	);
};
