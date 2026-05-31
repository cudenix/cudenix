import type { AnyContext } from "@/core/context";
import type { Chain, Endpoint } from "@/core/cudenix";
import { Error } from "@/core/error";
import type { ValidatorPlugin } from "@/core/validator";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";

const walk = async (
	endpoint: Endpoint,
	request: Request,
	context: AnyContext,
	chain: Chain,
	index: number,
) => {
	for (let i = index; i < chain.length; i++) {
		const link = chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "MIDDLEWARE") {
			const returned = await link.handler(context, () =>
				walk(endpoint, request, context, chain, i + 1),
			);

			if (returned) {
				context.response.content = returned;
			}

			return;
		}

		if (link.type === "STORE") {
			const returned = await link.handler(context);

			if (returned instanceof Error) {
				context.response.content = returned;

				return;
			}

			merge(context.store, returned);

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

	context.response.content = await endpoint.route.handler(context);
};

export const dispatch = async (
	endpoint: Endpoint,
	request: Request,
	context: AnyContext,
	chain: Chain,
	index: number,
) => {
	await walk(endpoint, request, context, chain, index);

	return new Response();
};
