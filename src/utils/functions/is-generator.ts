const AsyncGeneratorFunction = async function* () {}.constructor as Function;

const GeneratorFunction = function* () {}.constructor as Function;

export const isGenerator = (fn: (...args: any[]) => any) => {
	return (
		fn instanceof AsyncGeneratorFunction || fn instanceof GeneratorFunction
	);
};
