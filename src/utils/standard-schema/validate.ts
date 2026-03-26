export const validateStandardSchema = (schema: any, input: unknown) => {
	const result = schema["~standard"].validate(input);

	if (result instanceof Promise) {
		return result.then(({ issues, value }) => {
			return {
				content: issues ?? value,
				success: !issues,
			};
		});
	}

	return {
		content: result.issues ?? result.value,
		success: !result.issues,
	};
};
