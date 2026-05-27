import { Error } from "@/core/error";
import { Module } from "@/core/module";
import { FrozenEmpty } from "@/utils/objects/empty";

interface TryCatchOptions {
	debug?: boolean;
}

export const tryCatch = ({ debug = false }: TryCatchOptions = FrozenEmpty) =>
	new Module().middleware(async (_context, next) => {
		try {
			await next();
		} catch (_error) {
			if (debug) {
				console.error(_error);
			}

			return new Error(_error || "An unknown error has occurred.", {
				status: 500,
			});
		}
	});
