export const validateStandardSchema = async (schema: any, input: unknown) => {
	const { issues, value } = await schema["~standard"].validate(input);

	return {
		content: issues ?? value,
		success: !issues,
	};
};
