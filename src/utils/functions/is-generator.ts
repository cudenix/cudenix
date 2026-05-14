const GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(function* () {});

const ASYNC_GENERATOR_FUNCTION_PROTOTYPE = Object.getPrototypeOf(
	async function* () {},
);

export const isGenerator = (fn: (...args: any[]) => unknown) => {
	const prototype = Object.getPrototypeOf(fn);

	return (
		prototype === GENERATOR_FUNCTION_PROTOTYPE ||
		prototype === ASYNC_GENERATOR_FUNCTION_PROTOTYPE
	);
};
