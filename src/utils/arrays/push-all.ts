export const pushAll = <Type>(target: Type[], source: Type[]) => {
	const baseLength = target.length;
	const sourceLength = source.length;

	target.length = baseLength + sourceLength;

	let j = baseLength;

	for (let i = 0; i < sourceLength; i++) {
		target[j++] = source[i]!;
	}
};
