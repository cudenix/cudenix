export const merge = <
	T extends Record<string, unknown>,
	U extends Record<string, unknown>,
>(
	target: T,
	source: { [K in keyof U]: K extends keyof T ? T[K] : U[K] } & U,
): void => {
	// oxlint-disable-next-line guard-for-in -- We are intentionally iterating over all keys in the source object
	for (const key in source) {
		(target as Record<string, unknown>)[key] = (
			source as Record<string, unknown>
		)[key];
	}
};
