import type { AnyContext } from "@/core/context";
import type { Chain, Endpoint } from "@/core/cudenix";
import { Error } from "@/core/error";
import { merge } from "@/utils/objects/merge";

export const execute = async (
	endpoint: Endpoint,
	request: Request,
	context: AnyContext,
	chain: Chain,
	index: number,
) => {
	for (let i = index; i < chain.length; i++) {
		if (context.response.content) {
			break;
		}

		const link = chain[i];

		if (!link || link.type === "ROUTE") {
			continue;
		}

		if (link.type === "MIDDLEWARE") {
			const middleware = await link.middleware(context, () =>
				execute(endpoint, request, context, chain, i + 1),
			);

			if (middleware) {
				context.response.content = middleware;
			}

			continue;
		}

		if (link.type === "STORE") {
			const store = await link.store(context);

			if (store instanceof Error) {
				context.response.content = store;
			} else {
				merge(context.store, store);
			}

			continue;
		}

		if (link.type === "VALIDATOR") {
			// TODO: Add validator plugin support
		}
	}
};
