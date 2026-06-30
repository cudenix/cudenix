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

/**
 * Emit the dispatcher body for one endpoint chain.
 *
 * A single generator drives both shapes the runtime needs, selected by
 * `needsContext`:
 *
 * - With a context, every link receives the shared request `Context`, results
 *   flow through `context.response.content`, stores merge into `context.store`,
 *   validators run, and the function returns the full {@link RESPONSE_CALL}
 *   (carrying cookies and headers).
 * - Without one — when no link, validator, or handler can reach the context —
 *   the `Context` is never allocated: links are called with `undefined`, results
 *   flow through a local `content` binding, stores cannot merge (there is no
 *   store to merge into), and the function returns a plain `response(content)`.
 */
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
	isValidatorAsync: boolean,
	needsContext: boolean,
): string => {
	const linkArgument = needsContext ? "context" : "undefined";
	const routeArgument = needsContext ? "context" : "";
	const contentTarget = needsContext ? "context.response.content" : "content";
	const returnResponse = needsContext
		? `return ${RESPONSE_CALL};`
		: "return response(content);";

	if (index >= chain.length) {
		if (isSse) {
			const body = `${needsContext ? "context" : "app"}.server.timeout(request, 0);

				${contentTarget} = stream(handler(${routeArgument}));`;

			return isNested ? body : `${body}\n\n${returnResponse}`;
		}

		const callCode = `${contentTarget} = ${isRouteAsync ? "await " : ""}handler(${routeArgument});`;

		return isNested ? callCode : `${callCode}\n\n${returnResponse}`;
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
			isValidatorAsync,
			needsContext,
		);
	}

	if (link.type === "MIDDLEWARE") {
		const isTailAsync = needsAwait[index + 1];

		const callCode =
			isLinkAsync[index] || isTailAsync
				? `const returned_${index} = await chain[${index}].handler(${linkArgument}, next_${index});`
				: `const returned_${index} = chain[${index}].handler(${linkArgument}, next_${index});`;

		const block = `{
			const next_${index} = ${isTailAsync ? "async " : ""}() => {
				${generate(chain, index + 1, isSse, parsed, true, needsAwait, isLinkAsync, isRouteAsync, parsers, hasValidator, isValidatorAsync, needsContext)}
			};

			${callCode}

			if (returned_${index}) {
				${contentTarget} = returned_${index};
			}
		}`;

		return isNested ? block : `${block}\n\n${returnResponse}`;
	}

	if (link.type === "STORE") {
		const callCode = isLinkAsync[index]
			? `const returned_${index} = await chain[${index}].handler(${linkArgument});`
			: `const returned_${index} = chain[${index}].handler(${linkArgument});`;

		const shortCircuit = isNested
			? `${contentTarget} = returned_${index};\n\n\t\t\t\treturn;`
			: `${contentTarget} = returned_${index};\n\n\t\t\t\t${returnResponse}`;

		const mergeStore = needsContext
			? `

			if (returned_${index}) {
				merge(context.store, returned_${index});
			}`
			: "";

		return `{
			${callCode}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				${shortCircuit}
			}${mergeStore}
		}

		${generate(chain, index + 1, isSse, parsed, isNested, needsAwait, isLinkAsync, isRouteAsync, parsers, hasValidator, isValidatorAsync, needsContext)}`;
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
				isValidatorAsync,
				needsContext,
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
					const validated = ${isValidatorAsync ? "await " : ""}validator(
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

		${generate(chain, index + 1, isSse, parsed, isNested, needsAwait, isLinkAsync, isRouteAsync, parsers, hasValidator, isValidatorAsync, needsContext)}`;
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
		isValidatorAsync,
		needsContext,
	);
};

/**
 * Walk the chain back-to-front to resolve the async/context shape the
 * dispatcher is generated against.
 *
 * Two per-link arrays come out of the pass:
 *
 * - `isLinkAsync[i]` — whether link `i`'s own handler is declared `async` (only
 *   middleware and store links call a handler directly).
 * - `needsAwait[i]` — whether anything from link `i` onward awaits, so the
 *   generator knows when a `next()` closure must itself be `async`. The extra
 *   `needsAwait[length]` slot seeds the tail (the route handler).
 *
 * Alongside them two whole-chain flags fold up:
 *
 * - `isTailAsync` — whether the dispatcher needs the `async` keyword at all.
 * - `needsContext` — whether any link, validator, or the handler reaches the
 *   shared request `Context`; when false the `Context` is never allocated.
 */
const analyzeChain = (
	chain: EndpointChain,
	handler: Endpoint["route"]["handler"],
	isSse: boolean,
	isRouteAsync: boolean,
	hasValidator: boolean,
	isValidatorAsync: boolean,
): {
	isLinkAsync: boolean[];
	isTailAsync: boolean;
	needsAwait: boolean[];
	needsContext: boolean;
} => {
	const length = chain.length;

	const isLinkAsync = new Array<boolean>(length);
	const needsAwait = new Array<boolean>(length + 1);

	let isTailAsync = !isSse && isRouteAsync;
	let needsContext = usesContext(handler);

	needsAwait[length] = isTailAsync;

	for (let i = length - 1; i >= 0; i--) {
		const link = chain[i];

		if (link) {
			if (link.type === "VALIDATOR") {
				if (hasValidator) {
					if (isValidatorAsync || link.keys.includes("body")) {
						isTailAsync = true;
					}

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

	return { isLinkAsync, isTailAsync, needsAwait, needsContext };
};

export const jit = (app: Cudenix, endpoint: Endpoint) => {
	const chain = endpoint.chain;
	const handler = endpoint.route.handler;
	const isRouteAsync = isAsync(handler);
	const isSse = endpoint.route.sse;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const hasValidator = validator !== undefined;
	const isValidatorAsync = hasValidator && isAsync(validator);

	const { isLinkAsync, needsAwait, isTailAsync, needsContext } = analyzeChain(
		chain,
		handler,
		isSse,
		isRouteAsync,
		hasValidator,
		isValidatorAsync,
	);

	const asyncKeyword = isTailAsync ? "async " : "";

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

	const prelude = needsContext
		? `\nconst context = new Context(app, request, match);\nconst isBun = "cookies" in request;\n\n`
		: "\nlet content;\n\n";

	const body = generate(
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
		isValidatorAsync,
		needsContext,
	);

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
