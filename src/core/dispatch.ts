import type { AnyContext } from "@/core/context";
import type { Chain, Endpoint } from "@/core/cudenix";
import { Error } from "@/core/error";
import type { ValidatorPlugin } from "@/core/validator";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";

export const dispatch = async (
	endpoint: Endpoint,
	request: Request,
	context: AnyContext,
	chain: Chain,
	index: number,
) => {
	for (let i = index; i < chain.length; i++) {
		if (context.response.content) {
			return;
		}

		const link = chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "MIDDLEWARE") {
			const middleware = await link.middleware(context, () =>
				dispatch(endpoint, request, context, chain, i + 1),
			);

			if (middleware) {
				context.response.content = middleware;
			}

			return;
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
			const validator = context.memory.validator as
				| ValidatorPlugin
				| undefined;

			if (!validator) {
				continue;
			}

			let errors: Record<string, unknown> | undefined;

			for (let j = 0; j < link.keys.length; j++) {
				const key = link.keys[j];

				if (!key) {
					continue;
				}

				const validated = await validator(
					link.request[key],
					context.request[key],
					key,
				);

				if (!validated.success) {
					if (!errors) {
						errors = new Empty();
					}

					errors[key] = validated.content;

					continue;
				}

				context.request[key] = validated.content;
			}

			if (errors) {
				context.response.content = new Error(errors, { status: 422 });

				return;
			}
		}
	}

	if (context.response.content) {
		return;
	}

	context.response.content = await endpoint.route.route(context);
};
