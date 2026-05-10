export const cloneAppend = <Type>(array: Type[], item: Type): Type[] => {
	const length = array.length;

	const out = new Array<Type>(length + 1);

	for (let i = 0; i < length; i++) {
		out[i] = array[i]!;
	}

	out[length] = item;

	return out;
};
