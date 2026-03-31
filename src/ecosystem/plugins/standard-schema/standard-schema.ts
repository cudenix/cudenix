import type { App } from "@/core/app";

export const standardSchema = () => {
	return function (this: App) {
		this.memory.set("validator", (schema: any, input: unknown) => {
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
		});
	};
};
