import { Module } from "@/core/module";
import { fail } from "@/core/reply";
import { FrozenEmpty } from "@/utils/objects/empty";
import { peekStatus } from "@/utils/promises/peek";

interface TryCatchOptions {
	debug?: boolean;
}

export const tryCatch = ({ debug = false }: TryCatchOptions = FrozenEmpty) =>
	new Module().middleware(async (_context, next) => {
		try {
			const returned = next();

			// a chain that never suspends settles before it is read
			if (peekStatus(returned) !== "fulfilled") {
				await returned;
			}
		} catch (_error) {
			if (debug) {
				console.error(_error);
			}

			return fail(_error || "An unknown error has occurred.", {
				status: 500,
			});
		}
	});
