export const tryParse = (value: string) => {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};
