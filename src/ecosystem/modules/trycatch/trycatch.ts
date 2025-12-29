import { error } from "@/core/error";
import { module } from "@/core/module";

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
