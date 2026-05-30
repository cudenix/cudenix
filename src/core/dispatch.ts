import type { AnyContext } from "@/core/context";
import type { Chain, Endpoint } from "@/core/cudenix";
import { Error } from "@/core/error";
import type { ValidatorPlugin, ValidatorRequest } from "@/core/validator";
import type { MaybePromise } from "@/types/maybe-promise";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { merge } from "@/utils/objects/merge";
import { parseParams } from "@/utils/urls/parse-params";
import { parseQuery } from "@/utils/urls/parse-query";

const loadRequest = (
	key: keyof ValidatorRequest,
	request: Request,
	context: AnyContext,
	endpoint: Endpoint,
): MaybePromise<unknown> => {
	switch (key) {
		case "body":
			return parseBody(request);
		case "cookies":
			return parseCookies(request.headers.get("cookie") ?? "");
		case "headers":
			return request.headers.toJSON();
		case "params":
			return endpoint.router === "bun"
				? (request as unknown as { params: Record<string, string> })
						.params
				: parseParams(
						context.match,
						endpoint.paramKeys,
						endpoint.matchOffset,
						endpoint.restKeys,
					);
		case "query":
			return parseQuery(request.url);
	}
};

export const dispatch = async (
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

			const requestData = context.request as Record<string, unknown>;

			for (let j = 0; j < link.keys.length; j++) {
				const key = link.keys[j];

				if (!key) {
					continue;
				}

				if (!(key in requestData)) {
					const raw = loadRequest(key, request, context, endpoint);

					requestData[key] = raw instanceof Promise ? await raw : raw;
				}

				const validated = await validator(
					link.request[key],
					requestData[key],
					key,
				);

				if (!validated.success) {
					context.response.content = new Error(
						[
							{
								details: [
									{ details: [validated.content], type: key },
								],
							},
						],
						{ status: 422 },
					);

					break;
				}

				requestData[key] = validated.content;
			}
		}
	}

	if (context.response.content) {
		return;
	}

	context.response.content = await endpoint.route.route(context);
};
