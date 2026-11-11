export const cloneAppend = <T>(array: readonly T[], item: T): T[] => {
	const { length } = array;

	if (length === 0) {
		return [item];
	}

	if (length === 1) {
		return [array[0]!, item];
	}

	if (length === 2) {
		return [array[0]!, array[1]!, item];
	}

	if (length === 3) {
		return [array[0]!, array[1]!, array[2]!, item];
	}

	if (length === 4) {
		return [array[0]!, array[1]!, array[2]!, array[3]!, item];
	}

	const out = new Array<T>(length + 1);

	for (let i = 0; i < length; i++) {
		out[i] = array[i]!;
	}

	out[length] = item;

	return out;
};
