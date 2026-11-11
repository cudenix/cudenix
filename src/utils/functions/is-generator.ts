const GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(function* () {
	// empty generator function to get its prototype
}) as unknown;
const ASYNC_GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(
	async function* () {
		// empty async generator function to get its prototype
	},
) as unknown;

export const isGenerator = (fn: (...args: any[]) => unknown): boolean => {
	const prototype = Object.getPrototypeOf(fn) as unknown;

	return (
		prototype === GENERATOR_FUNCTION_PROTOTYPE ||
		prototype === ASYNC_GENERATOR_FUNCTION_PROTOTYPE
	);
};
