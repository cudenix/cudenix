export const HEX_VALUES = ((): Int8Array<ArrayBuffer> => {
	const values = new Int8Array(256).fill(-1);

	values.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 48);

	values.set([10, 11, 12, 13, 14, 15], 65);

	values.set([10, 11, 12, 13, 14, 15], 97);

	return values;
})();
