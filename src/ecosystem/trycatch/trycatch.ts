import { error } from "@/error";
import { module as _module } from "@/module";

const module = () => {
	return _module().middleware(async (_context, next) => {
		try {
			return await next();
		} catch (exception) {
			return error(exception || "An unknown error has occurred", 500);
		}
	});
};

export const trycatch = {
	module,
};
