import { error } from "@/core/error";
import { module } from "@/core/module";
import { FreezeEmpty } from "@/utils/objects/empty";

interface TryCatchOptions {
	debug?: boolean;
}

export const tryCatch = ({ debug = false }: TryCatchOptions = FreezeEmpty) => {
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
