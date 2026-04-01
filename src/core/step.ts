import type { App, Chain, Endpoint } from "@/core/app";
import type { Context } from "@/core/context";
import { Error } from "@/core/error";
import { processResponse } from "@/core/response";
import type { RouteFnReturnGenerator } from "@/core/route";
import type {
	AnyValidator,
	ValidatorPlugin,
	ValidatorRequest,
} from "@/core/validator";
import type { MaybePromise } from "@/types/maybe-promise";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";

interface ValidatorState {
	errors?: {
		details: unknown[];
		type: keyof ValidatorRequest;
	}[];
	index?: Record<string, number>;
}

const applyValidation = (
	validated: {
		content: unknown;
		success: boolean;
	},
	key: keyof ValidatorRequest,
	context: Context,
	state: ValidatorState,
) => {
	if (validated.success) {
		context.request[key as keyof typeof context.request] =
			validated.content as any;

		return;
	}

	const content = Array.isArray(validated.content)
		? validated.content
		: [validated.content];

	state.errors ??= [];
	state.index ??= new Empty() as Record<string, number>;

	if (state.index[key] !== undefined) {
		state.errors[state.index[key]]?.details.push(...content);

		return;
	}

	state.index[key] = state.errors.length;

	state.errors.push({
		details: content,
		type: key,
	});
};

const processValidators = (
	context: Context,
	link: AnyValidator,
	validatorPlugin: ValidatorPlugin,
	startI: number,
	state: ValidatorState,
): MaybePromise<void> => {
	for (let i = startI; i < link.keys.length; i++) {
		const key = link.keys[i];

		if (!key) {
			continue;
		}

		const validated = validatorPlugin(
			link.request[key],
			context.request[key as keyof typeof context.request],
			key,
		);

		if (validated instanceof Promise) {
			return validated.then((resolved) => {
				applyValidation(resolved, key, context, state);

				return processValidators(
					context,
					link,
					validatorPlugin,
					i + 1,
					state,
				);
			});
		}

		applyValidation(validated, key, context, state);
	}

	if (state.errors) {
		context.response.content = new Error(state.errors, {
			status: 422,
		});
	}
};

const resolveRoute = (
	app: App,
	context: Context,
	request: Request,
	endpoint: Endpoint,
	returned: any,
) => {
	if (endpoint.route.method === "WS") {
		app.server?.upgrade(request, {
			data: {
				close: (
					ws: Bun.ServerWebSocket<unknown>,
					code: number,
					reason: string,
				) => {
					return returned?.close?.(ws, code, reason);
				},
				drain: (ws: Bun.ServerWebSocket<unknown>) => {
					return returned?.drain?.(ws);
				},
				message: (
					ws: Bun.ServerWebSocket<unknown>,
					message: string,
				) => {
					return returned?.message(ws, message);
				},
				open: (ws: Bun.ServerWebSocket<unknown>) => {
					return returned?.open?.(ws);
				},
			},
		});

		return;
	}

	context.response.content = returned;
};

const step = (
	app: App,
	context: Context,
	endpoint: Endpoint,
	request: Request,
	chain: Chain,
	index: number,
	validatorPlugin: ValidatorPlugin | undefined,
): MaybePromise<void> => {
	for (let i = index; i < chain.length; i++) {
		if (context.response.content) {
			return;
		}

		const link = chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "ROUTE") {
			continue;
		}

		if (link.type === "MIDDLEWARE") {
			const middleware = link.middleware(context, () => {
				return step(
					app,
					context,
					endpoint,
					request,
					chain,
					i + 1,
					validatorPlugin,
				);
			});

			if (middleware instanceof Promise) {
				return middleware.then((resolved) => {
					if (resolved) {
						context.response.content =
							resolved as unknown as typeof context.response.content;
					}
				});
			}

			if (middleware) {
				context.response.content = middleware;
			}

			return;
		}

		if (link.type === "STORE") {
			const store = link.store(context);

			if (store instanceof Promise) {
				return store.then((resolved: unknown) => {
					if (resolved instanceof Error) {
						context.response.content = resolved;

						return;
					}

					merge(
						context.store,
						resolved as Record<PropertyKey, unknown>,
					);

					return step(
						app,
						context,
						endpoint,
						request,
						chain,
						i + 1,
						validatorPlugin,
					);
				});
			}

			if (store instanceof Error) {
				context.response.content = store;
			} else {
				merge(context.store, store);
			}

			continue;
		}

		if (!link.request || !validatorPlugin) {
			continue;
		}

		const validationReturned = processValidators(
			context,
			link as AnyValidator,
			validatorPlugin,
			0,
			{
				errors: undefined,
				index: undefined,
			},
		);

		if (validationReturned instanceof Promise) {
			return validationReturned.then(() => {
				if (context.response.content) {
					return;
				}

				return step(
					app,
					context,
					endpoint,
					request,
					chain,
					i + 1,
					validatorPlugin,
				);
			});
		}
	}

	if (context.response.content) {
		return;
	}

	if (endpoint.generator) {
		context.response.content = new ReadableStream({
			async start(controller) {
				let closed = false;

				const onAbort = () => {
					closed = true;

					try {
						controller.close();
					} catch {}
				};

				request.signal.addEventListener("abort", onAbort, {
					once: true,
				});

				try {
					for await (const chunk of endpoint.route.route(
						context,
					) as RouteFnReturnGenerator) {
						if (closed) {
							break;
						}

						if (chunk.data.transform) {
							if (chunk.id) {
								controller.enqueue(`id: ${chunk.id}\n`);
							}

							if (chunk.event) {
								controller.enqueue(`event: ${chunk.event}\n`);
							}

							if (chunk.retry) {
								controller.enqueue(
									`retry: ${chunk.retry.toString()}\n`,
								);
							}

							controller.enqueue(
								`data: ${JSON.stringify(chunk.data)}\n\n`,
							);

							continue;
						}

						controller.enqueue(chunk.data.content);
					}
				} catch {
				} finally {
					request.signal.removeEventListener("abort", onAbort);

					onAbort();
				}
			},
		});

		return;
	}

	const returned = endpoint.route.route(context);

	if (returned instanceof Promise) {
		return returned.then((resolved) => {
			resolveRoute(app, context, request, endpoint, resolved);
		});
	}

	resolveRoute(app, context, request, endpoint, returned);
};

export const stepAndRespond = (
	app: App,
	context: Context,
	endpoint: Endpoint,
	request: Request,
) => {
	if (endpoint.chain.length === 0 && !endpoint.generator) {
		const returned = endpoint.route.route(context);

		if (returned instanceof Promise) {
			return returned.then((resolved) => {
				resolveRoute(app, context, request, endpoint, resolved);

				return processResponse(context.response, {
					serializeCookies: !!endpoint.paramsRegexp,
				});
			});
		}

		resolveRoute(app, context, request, endpoint, returned);

		return processResponse(context.response, {
			serializeCookies: !!endpoint.paramsRegexp,
		});
	}

	const returned = step(
		app,
		context,
		endpoint,
		request,
		endpoint.chain,
		0,
		app.memory.get("validator") as ValidatorPlugin | undefined,
	);

	if (returned instanceof Promise) {
		return returned.then(() => {
			return processResponse(context.response, {
				serializeCookies: !!endpoint.paramsRegexp,
			});
		});
	}

	return processResponse(context.response, {
		serializeCookies: !!endpoint.paramsRegexp,
	});
};
