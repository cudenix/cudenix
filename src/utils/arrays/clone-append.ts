export const cloneAppend = <Type>(array: Type[], item: Type) => {
	const length = array.length;

	if (length === 0) {
		return [item];
	}

	if (length === 1) {
		return [array[0]!, item];
	}

	const out = new Array<Type>(length + 1);

	for (let i = 0; i < length; i++) {
		out[i] = array[i]!;
	}

	out[length] = item;

	return out;
};
