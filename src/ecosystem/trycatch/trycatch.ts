import { error } from "@/error";
import { module } from "@/module";

export const trycatch = {
	module: () => {
		return module().middleware(async (_context, next) => {
			try {
				return await next();
			} catch (exception) {
				return error(exception || "An unknown error has occurred", 500);
			}
		});
	},
};
