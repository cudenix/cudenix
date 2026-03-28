const AsyncGeneratorFunction = async function* () {}.constructor as Function;

const GeneratorFunction = function* () {}.constructor as Function;

export const isGenerator = (fn: Function) =>
	fn instanceof AsyncGeneratorFunction || fn instanceof GeneratorFunction;
