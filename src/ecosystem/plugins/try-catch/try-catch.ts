import { Module } from "@/core/module";
import { fail } from "@/core/reply";
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

			return fail(_error || "An unknown error has occurred.", {
				status: 500,
			});
		}
	});
