const AsyncGeneratorFunction = async function* AsyncGeneratorFunction() {}.constructor as (
	...args: any[]
) => unknown;

const GeneratorFunction = function* GeneratorFunction() {}.constructor as (
	...args: any[]
) => unknown;

export const isGenerator = (fn: (...args: any[]) => unknown) =>
	fn instanceof AsyncGeneratorFunction || fn instanceof GeneratorFunction;
