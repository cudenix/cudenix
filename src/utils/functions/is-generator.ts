/**
 * @module
 * Runtime detector for generator functions.
 */

const GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(function* () {});

const ASYNC_GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(
	async function* () {},
);

/**
 * Check whether `fn` was declared as a generator — `function*` or
 * `async function*`. Identity-based against cached prototypes, so the result
 * survives bundler renames.
 *
 * Pass the function itself, not the iterator it returns: `isGenerator(gen)`
 * is `true`, but `isGenerator(gen())` is `false`. Sync and async generators
 * are not distinguished — both return `true`. Plain async functions
 * (`async () => {}`) return `false`.
 *
 * @param fn - Function to inspect.
 * @returns `true` when `fn` is a sync or async generator function.
 * @example
 * ```typescript
 * isGenerator(function* () {}); // true
 * isGenerator(async function* () {}); // true
 * isGenerator(async () => {}); // false
 * isGenerator(() => {}); // false
 *
 * if (isGenerator(fn)) {
 *   for await (const v1 of fn(p1)) {
 *     // consume each yielded value
 *   }
 * } else {
 *   await fn(p1);
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
