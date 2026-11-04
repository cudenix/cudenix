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

	// "0" (48) - "9" (57)
	for (let charCode = 48; charCode <= 57; charCode++) {
		values[charCode] = charCode - 48;
	}

	// "a"-"f" map to 10-15, "- 32" for uppercase
	for (let charCode = 97; charCode <= 102; charCode++) {
		values[charCode] = charCode - 87;
		values[charCode - 32] = charCode - 87;
	}

	return values;
})();
