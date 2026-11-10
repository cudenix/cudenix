/**
 * Hexadecimal digit values indexed by char code, `-1` for anything else.
 *
 * @example
 * ```typescript
 * HEX_VALUES[97]; // 10 ("a")
 * HEX_VALUES[103]; // -1 ("g")
 * ```
 */
export const HEX_VALUES = /* @__PURE__ */ ((): Int8Array<ArrayBuffer> => {
	const values = new Int8Array(256).fill(-1);

	// "0"-"9" from char code 48
	values.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 48);

	// "A"-"F" from char code 65
	values.set([10, 11, 12, 13, 14, 15], 65);

	// "a"-"f" from char code 97
	values.set([10, 11, 12, 13, 14, 15], 97);

	return values;
})();
