import { error, module } from "@/core";

export const trycatch = () => {
	return module().middleware(async (context, next) => {
		try {
			await next();
		} catch (exception) {
			return error(exception || "An unknown error has occurred.", {
				status: 500,
			});
		}
	});
};
