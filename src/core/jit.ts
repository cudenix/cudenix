import { Context } from "@/core/context";
import type { Cudenix, Endpoint, EndpointChain } from "@/core/cudenix";
import type { Dispatch } from "@/core/dispatch";
import { fail, Reply } from "@/core/reply";
import { response } from "@/core/response";
import { stream } from "@/core/sse";
import type { ValidatorPlugin, ValidatorRequest } from "@/core/validator";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { isAsync } from "@/utils/functions/is-async";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";
import { parseQuery } from "@/utils/urls/parse-query";

const RESPONSE_CALL =
	"response(context.response.content, isBun ? undefined : context.response.cookies, context.response.headers)";

const PARSERS = {
	body: "context.request.body = await parseBody(request);",
	cookies: `context.request.cookies = parseCookies(request.headers.get("cookie") ?? "");`,
	headers: "context.request.headers = request.headers.toJSON();",
	query: "context.request.query = parseQuery(request.url);",
};

const paramsParser = (
	paramKeys: string[],
	matchOffset: number,
	restKeys: string[],
): string => {
	if (paramKeys.length === 0) {
		return "context.request.params = isBun ? request.params : new Empty();";
	}

	let assigns = "";

	for (let i = 0; i < paramKeys.length; i++) {
		const name = paramKeys[i];

		if (name === undefined) {
			continue;
		}

		const slot = matchOffset + 1 + i;
		const json = JSON.stringify(name);
		const stored =
			restKeys.indexOf(name) !== -1 ? 'value.split("/")' : "value";

		assigns += `
				{
					let value = match[${slot}];

					if (value !== undefined) {
						if (value.indexOf("%") !== -1) {
							try {
								value = decodeURIComponent(value);
							} catch {}
						}

						params[${json}] = ${stored};
					}
				}`;
	}

	return `let params;

			if (isBun) {
				params = request.params;
			} else {
				params = new Empty();

				if (match !== undefined) {${assigns}
				}
			}

			context.request.params = params;`;
};

const generate = (
	chain: EndpointChain,
	index: number,
	sse: boolean,
	parsed: Set<string>,
	nested: boolean,
	needsAwait: boolean[],
	linkAsync: boolean[],
	isRouteAsync: boolean,
	parsers: Record<keyof ValidatorRequest, string>,
	hasValidator: boolean,
): string => {
	if (index >= chain.length) {
		if (sse) {
			const body = `context.server.timeout(request, 0);

				context.response.content = stream(handler(context));`;

			return nested ? body : `${body}\n\nreturn ${RESPONSE_CALL};`;
		}

		const call = isRouteAsync
			? "context.response.content = await handler(context);"
			: "context.response.content = handler(context);";

		return nested ? call : `${call}\n\nreturn ${RESPONSE_CALL};`;
	}

	const link = chain[index];

	if (!link) {
		return generate(
			chain,
			index + 1,
			sse,
			parsed,
			nested,
			needsAwait,
			linkAsync,
			isRouteAsync,
			parsers,
			hasValidator,
		);
	}

	if (link.type === "MIDDLEWARE") {
		const tailAsync = needsAwait[index + 1];

		const call =
			linkAsync[index] || tailAsync
				? `const returned_${index} = await chain[${index}].handler(context, next_${index});`
				: `const returned_${index} = chain[${index}].handler(context, next_${index});`;

		const block = `{
			const next_${index} = ${tailAsync ? "async " : ""}() => {
				${generate(chain, index + 1, sse, parsed, true, needsAwait, linkAsync, isRouteAsync, parsers, hasValidator)}
			};

			${call}

			if (returned_${index}) {
				context.response.content = returned_${index};
			}
		}`;

		return nested ? block : `${block}\n\nreturn ${RESPONSE_CALL};`;
	}

	if (link.type === "STORE") {
		const call = linkAsync[index]
			? `const returned_${index} = await chain[${index}].handler(context);`
			: `const returned_${index} = chain[${index}].handler(context);`;

		return `{
			${call}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				context.response.content = returned_${index};

				return${nested ? "" : ` ${RESPONSE_CALL}`};
			}

			if (returned_${index}) {
				merge(context.store, returned_${index});
			}
		}

		${generate(chain, index + 1, sse, parsed, nested, needsAwait, linkAsync, isRouteAsync, parsers, hasValidator)}`;
	}

	if (link.type === "VALIDATOR") {
		if (!hasValidator) {
			return generate(
				chain,
				index + 1,
				sse,
				parsed,
				nested,
				needsAwait,
				linkAsync,
				isRouteAsync,
				parsers,
				hasValidator,
			);
		}

		let keys = "";

		for (let i = 0; i < link.keys.length; i++) {
			const key = link.keys[i];

			if (!key) {
				continue;
			}

			let load = "";

			if (!parsed.has(key)) {
				parsed.add(key);

				load = parsers[key];
			}

			const json = JSON.stringify(key);

			const validate = `{
					const validated = await validator(
						request_${index}[${json}],
						context.request[${json}],
						${json},
					);

					if (validated.success) {
						context.request[${json}] = validated.content;
					} else {
						(errors_${index} ??= new Empty())[${json}] = validated.content;
					}
				}`;

			keys += load ? `\n\n${load}\n\n${validate}` : `\n\n${validate}`;
		}

		return `{
			const request_${index} = chain[${index}].request;
			
			let errors_${index};

			${keys}

			if (errors_${index}) {
				context.response.content = fail(errors_${index}, { status: 422 });

				return${nested ? "" : ` ${RESPONSE_CALL}`};
			}
		}

		${generate(chain, index + 1, sse, parsed, nested, needsAwait, linkAsync, isRouteAsync, parsers, hasValidator)}`;
	}

	return generate(
		chain,
		index + 1,
		sse,
		parsed,
		nested,
		needsAwait,
		linkAsync,
		isRouteAsync,
		parsers,
		hasValidator,
	);
};

export const jit = (app: Cudenix, endpoint: Endpoint) => {
	const chain = endpoint.chain;
	const handler = endpoint.route.handler;
	const sse = endpoint.route.sse;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const hasValidator = validator !== undefined;

	const length = chain.length;
	const linkAsync = new Array<boolean>(length);
	const needsAwait = new Array<boolean>(length + 1);
	const isRouteAsync = isAsync(handler);

	let tail = !sse && isRouteAsync;

	needsAwait[length] = tail;

	for (let i = length - 1; i >= 0; i--) {
		const link = chain[i];

		if (link) {
			if (link.type === "VALIDATOR") {
				if (hasValidator) {
					tail = true;
				}
			} else if (link.type === "MIDDLEWARE" || link.type === "STORE") {
				const async = isAsync(link.handler);

				linkAsync[i] = async;
				tail = async || tail;
			}
		}

		needsAwait[i] = tail;
	}

	const parsers: Record<keyof ValidatorRequest, string> = {
		body: PARSERS.body,
		cookies: PARSERS.cookies,
		headers: PARSERS.headers,
		params: paramsParser(
			endpoint.paramKeys,
			endpoint.matchOffset,
			endpoint.restKeys,
		),
		query: PARSERS.query,
	};

	const async = tail ? "async " : "";

	const factory = new Function(
		"app",
		"Context",
		"chain",
		"response",
		"Reply",
		"merge",
		"Empty",
		"fail",
		"stream",
		"parseBody",
		"parseCookies",
		"parseQuery",
		"validator",
		"handler",
		`return ${async}function (request, match) {\nconst context = new Context(app, request, match);\nconst isBun = "cookies" in request;\n\n${generate(chain, 0, sse, new Set(), false, needsAwait, linkAsync, isRouteAsync, parsers, hasValidator)}\n};`,
	) as (
		app: Cudenix,
		context: typeof Context,
		chain: EndpointChain,
		responseBuilder: typeof response,
		reply: typeof Reply,
		mergeObjects: typeof merge,
		empty: typeof Empty,
		failReply: typeof fail,
		sseStream: typeof stream,
		bodyParser: typeof parseBody,
		cookieParser: typeof parseCookies,
		queryParser: typeof parseQuery,
		validatorPlugin: ValidatorPlugin | undefined,
		routeHandler: Endpoint["route"]["handler"],
	) => Dispatch;

	return factory(
		app,
		Context,
		chain,
		response,
		Reply,
		merge,
		Empty,
		fail,
		stream,
		parseBody,
		parseCookies,
		parseQuery,
		validator,
		handler,
	);
};
