import type { Cudenix } from "@/core/cudenix";

export const initializeStandardSchema = () =>
	function initializeStandardSchema(this: Cudenix) {
		this.memory.validator = async (schema: any, input: unknown) => {
			const returned = await schema["~standard"].validate(input);

			return {
				content: returned.issues ?? returned.value,
				success: !returned.issues,
			};
		};
	};
