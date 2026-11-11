export const pushAll = <T>(target: T[], source: readonly T[]): void => {
	const sourceLength = source.length;

	let i = 0;

	for (const end = sourceLength - 3; i < end; i += 4) {
		target.push(source[i]!, source[i + 1]!, source[i + 2]!, source[i + 3]!);
	}

	for (; i < sourceLength; i++) {
		target.push(source[i]!);
	}
};
