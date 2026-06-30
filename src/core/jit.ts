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
import { usesContext } from "@/utils/functions/uses-context";
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

const generateParamsParser = (
	paramKeys: string[],
	matchOffset: number,
	restKeys: string[],
): string => {
	if (paramKeys.length === 0) {
		return "context.request.params = isBun ? request.params : new Empty();";
	}

	let assignmentsCode = "";

	for (let i = 0; i < paramKeys.length; i++) {
		const name = paramKeys[i];

		if (name === undefined) {
			continue;
		}

		const matchGroupIndex = matchOffset + 1 + i;
		const keyLiteral = JSON.stringify(name);
		const paramValueExpression =
			restKeys.indexOf(name) !== -1 ? 'value.split("/")' : "value";

		assignmentsCode += `
				{
					let value = match[${matchGroupIndex}];

					if (value !== undefined) {
						if (value.indexOf("%") !== -1) {
							try {
								value = decodeURIComponent(value);
							} catch {}
						}

						params[${keyLiteral}] = ${paramValueExpression};
					}
				}`;
	}

	return `let params;

			if (isBun) {
				params = request.params;
			} else {
				params = new Empty();

				if (match !== undefined) {${assignmentsCode}
				}
			}

			context.request.params = params;`;
};

const generate = (
	chain: EndpointChain,
	index: number,
	isSse: boolean,
	parsed: Set<string>,
	isNested: boolean,
	needsAwait: boolean[],
	isLinkAsync: boolean[],
	isRouteAsync: boolean,
	parsers: Record<keyof ValidatorRequest, string>,
	hasValidator: boolean,
): string => {
	if (index >= chain.length) {
		if (isSse) {
			const body = `context.server.timeout(request, 0);

				context.response.content = stream(handler(context));`;

			return isNested ? body : `${body}\n\nreturn ${RESPONSE_CALL};`;
		}

		const callCode = isRouteAsync
			? "context.response.content = await handler(context);"
			: "context.response.content = handler(context);";

		return isNested ? callCode : `${callCode}\n\nreturn ${RESPONSE_CALL};`;
	}

	const link = chain[index];

	if (!link) {
		return generate(
			chain,
			index + 1,
			isSse,
			parsed,
			isNested,
			needsAwait,
			isLinkAsync,
			isRouteAsync,
			parsers,
			hasValidator,
		);
	}

	if (link.type === "MIDDLEWARE") {
		const isTailAsync = needsAwait[index + 1];

		const callCode =
			isLinkAsync[index] || isTailAsync
				? `const returned_${index} = await chain[${index}].handler(context, next_${index});`
				: `const returned_${index} = chain[${index}].handler(context, next_${index});`;

		const block = `{
			const next_${index} = ${isTailAsync ? "async " : ""}() => {
				${generate(chain, index + 1, isSse, parsed, true, needsAwait, isLinkAsync, isRouteAsync, parsers, hasValidator)}
			};

			${callCode}

			if (returned_${index}) {
				context.response.content = returned_${index};
			}
		}`;

		return isNested ? block : `${block}\n\nreturn ${RESPONSE_CALL};`;
	}

	if (link.type === "STORE") {
		const callCode = isLinkAsync[index]
			? `const returned_${index} = await chain[${index}].handler(context);`
			: `const returned_${index} = chain[${index}].handler(context);`;

		return `{
			${callCode}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				context.response.content = returned_${index};

				return${isNested ? "" : ` ${RESPONSE_CALL}`};
			}

			if (returned_${index}) {
				merge(context.store, returned_${index});
			}
		}

		${generate(chain, index + 1, isSse, parsed, isNested, needsAwait, isLinkAsync, isRouteAsync, parsers, hasValidator)}`;
	}

	if (link.type === "VALIDATOR") {
		if (!hasValidator) {
			return generate(
				chain,
				index + 1,
				isSse,
				parsed,
				isNested,
				needsAwait,
				isLinkAsync,
				isRouteAsync,
				parsers,
				hasValidator,
			);
		}

		let validationsCode = "";

		for (let i = 0; i < link.keys.length; i++) {
			const key = link.keys[i];

			if (!key) {
				continue;
			}

			let parserCode = "";

			if (!parsed.has(key)) {
				parsed.add(key);

				parserCode = parsers[key];
			}

			const keyLiteral = JSON.stringify(key);

			const validationCode = `{
					const validated = await validator(
						request_${index}[${keyLiteral}],
						context.request[${keyLiteral}],
						${keyLiteral},
					);

					if (validated.success) {
						context.request[${keyLiteral}] = validated.content;
					} else {
						(errors_${index} ??= new Empty())[${keyLiteral}] = validated.content;
					}
				}`;

			validationsCode += parserCode
				? `\n\n${parserCode}\n\n${validationCode}`
				: `\n\n${validationCode}`;
		}

		return `{
			const request_${index} = chain[${index}].request;
			
			let errors_${index};

			${validationsCode}

			if (errors_${index}) {
				context.response.content = fail(errors_${index}, { status: 422 });

				return${isNested ? "" : ` ${RESPONSE_CALL}`};
			}
		}

		${generate(chain, index + 1, isSse, parsed, isNested, needsAwait, isLinkAsync, isRouteAsync, parsers, hasValidator)}`;
	}

	return generate(
		chain,
		index + 1,
		isSse,
		parsed,
		isNested,
		needsAwait,
		isLinkAsync,
		isRouteAsync,
		parsers,
		hasValidator,
	);
};

const generateContextFree = (
	chain: EndpointChain,
	index: number,
	isSse: boolean,
	isNested: boolean,
	needsAwait: boolean[],
	isLinkAsync: boolean[],
	isRouteAsync: boolean,
): string => {
	if (index >= chain.length) {
		if (isSse) {
			return isNested
				? "app.server.timeout(request, 0);\n\n\t\t\t\t\tcontent = stream(handler());"
				: "app.server.timeout(request, 0);\n\nreturn response(stream(handler()));";
		}

		const call = isRouteAsync ? "await handler()" : "handler()";

		return isNested ? `content = ${call};` : `return response(${call});`;
	}

	const link = chain[index];

	if (!link) {
		return generateContextFree(
			chain,
			index + 1,
			isSse,
			isNested,
			needsAwait,
			isLinkAsync,
			isRouteAsync,
		);
	}

	if (link.type === "MIDDLEWARE") {
		const isTailAsync = needsAwait[index + 1];

		const callCode =
			isLinkAsync[index] || isTailAsync
				? `const returned_${index} = await chain[${index}].handler(undefined, next_${index});`
				: `const returned_${index} = chain[${index}].handler(undefined, next_${index});`;

		const block = `{
			const next_${index} = ${isTailAsync ? "async " : ""}() => {
				${generateContextFree(chain, index + 1, isSse, true, needsAwait, isLinkAsync, isRouteAsync)}
			};

			${callCode}

			if (returned_${index}) {
				content = returned_${index};
			}
		}`;

		return isNested
			? block
			: `let content;\n\n${block}\n\nreturn response(content);`;
	}

	if (link.type === "STORE") {
		const callCode = isLinkAsync[index]
			? `const returned_${index} = await chain[${index}].handler(undefined);`
			: `const returned_${index} = chain[${index}].handler(undefined);`;

		const shortCircuit = isNested
			? `content = returned_${index};\n\n\t\t\t\treturn;`
			: `return response(returned_${index});`;

		return `{
			${callCode}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				${shortCircuit}
			}
		}

		${generateContextFree(chain, index + 1, isSse, isNested, needsAwait, isLinkAsync, isRouteAsync)}`;
	}

	return generateContextFree(
		chain,
		index + 1,
		isSse,
		isNested,
		needsAwait,
		isLinkAsync,
		isRouteAsync,
	);
};

export const jit = (app: Cudenix, endpoint: Endpoint) => {
	const chain = endpoint.chain;
	const handler = endpoint.route.handler;
	const isSse = endpoint.route.sse;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const hasValidator = validator !== undefined;

	const length = chain.length;
	const isLinkAsync = new Array<boolean>(length);
	const needsAwait = new Array<boolean>(length + 1);
	const isRouteAsync = isAsync(handler);

	let isTailAsync = !isSse && isRouteAsync;
	let needsContext = usesContext(handler);

	needsAwait[length] = isTailAsync;

	for (let i = length - 1; i >= 0; i--) {
		const link = chain[i];

		if (link) {
			if (link.type === "VALIDATOR") {
				if (hasValidator) {
					isTailAsync = true;
					needsContext = true;
				}
			} else if (link.type === "MIDDLEWARE" || link.type === "STORE") {
				const isHandlerAsync = isAsync(link.handler);

				isLinkAsync[i] = isHandlerAsync;
				isTailAsync = isHandlerAsync || isTailAsync;

				if (!needsContext && usesContext(link.handler)) {
					needsContext = true;
				}
			}
		}

		needsAwait[i] = isTailAsync;
	}

	const asyncKeyword = isTailAsync ? "async " : "";

	let prelude: string;
	let body: string;

	if (needsContext) {
		const parsers: Record<keyof ValidatorRequest, string> = {
			body: PARSERS.body,
			cookies: PARSERS.cookies,
			headers: PARSERS.headers,
			params: generateParamsParser(
				endpoint.paramKeys,
				endpoint.matchOffset,
				endpoint.restKeys,
			),
			query: PARSERS.query,
		};

		prelude = `\nconst context = new Context(app, request, match);\nconst isBun = "cookies" in request;\n\n`;
		body = generate(
			chain,
			0,
			isSse,
			new Set(),
			false,
			needsAwait,
			isLinkAsync,
			isRouteAsync,
			parsers,
			hasValidator,
		);
	} else {
		prelude = "\n";
		body = generateContextFree(
			chain,
			0,
			isSse,
			false,
			needsAwait,
			isLinkAsync,
			isRouteAsync,
		);
	}

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
		`return ${asyncKeyword}function (request, match) {${prelude}${body}\n};`,
	) as (
		app: Cudenix,
		context: typeof Context,
		chain: EndpointChain,
		responseBuilder: typeof response,
		reply: typeof Reply,
		mergeObjects: typeof merge,
		empty: typeof Empty,
		failReply: typeof fail,
		isSseStream: typeof stream,
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
