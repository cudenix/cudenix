import { error } from "@/core/error";
import { module } from "@/core/module";

export interface TryCatchOptions {
	debug?: boolean;
}

export const tryCatch = ({ debug = false }: TryCatchOptions = {}) => {
	return module().middleware(async (context, next) => {
		try {
			await next();
		} catch (exception) {
			if (debug) {
				console.error(exception);
			}

			return error(exception || "An unknown error has occurred.", {
				status: 500,
			});
		}
	});
};
