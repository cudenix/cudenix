const GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(function* () {});
const ASYNC_GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(
	async function* () {},
);

/**
 * Check whether `fn` is a generator function — `function*` or `async function*`.
 *
 * @example
 * ```typescript
 * isGenerator(function* () {}); // true
 * isGenerator(async function* () {}); // true
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
