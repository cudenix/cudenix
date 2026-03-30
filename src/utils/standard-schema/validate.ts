export const validateStandardSchema = (schema: any, input: unknown) => {
	const returned = schema["~standard"].validate(input);

	if (returned instanceof Promise) {
		return returned.then(({ issues, value }) => {
			return {
				content: issues ?? value,
				success: !issues,
			};
		});
	}

	return {
		content: returned.issues ?? returned.value,
		success: !returned.issues,
	};
};
