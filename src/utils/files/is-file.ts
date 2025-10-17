export const isFile = (value: unknown) => {
	return value instanceof File || value instanceof Blob;
};
