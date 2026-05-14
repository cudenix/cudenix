export const pushAll = <Type>(target: Type[], source: Type[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	for (let i = 0; i < sourceLength; i++) {
		target[baseLength + i] = source[i]!;
	}
};
