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
import { decodePathParam } from "@/utils/urls/decode-path-param";
import { parseQuery } from "@/utils/urls/parse-query";

/**
 * Defines the response call used by full-context dispatchers.
 */
const RESPONSE_CALL =
	"response(context.response.content, context.response.cookies, context.response.headers)";

/**
 * Generates the path parameter parser for a dispatcher.
 */
const generateParamsParser = (
	paramKeys: string[],
	matchOffset: number,
	restKeys: string[],
	target: string,
): string => {
	if (paramKeys.length === 0) {
		return `${target} = isBun ? request.params : new Empty();`;
	}

	let assignmentsCode = "";

	for (let i = 0; i < paramKeys.length; i++) {
		const paramKey = paramKeys[i];

		if (paramKey === undefined) {
			continue;
		}

		const matchGroupIndex = matchOffset + 1 + i;
		const keyLiteral = JSON.stringify(paramKey);
		const paramValueExpression = restKeys.includes(paramKey)
			? 'value.split("/")'
			: "value";

		assignmentsCode += `
				{
					let value = match[${matchGroupIndex}];

					if (value !== undefined) {
						value = decodePathParam(value);

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

			${target} = params;`;
};

/**
 * Describes the shape used to generate an endpoint dispatcher.
 */
interface EndpointShape {
	asyncMap: boolean[];
	awaitMap: boolean[];
	hasValidationState: boolean;
	hasValidator: boolean;
	isChainAsync: boolean;
	isRouteAsync: boolean;
	isSse: boolean;
	isValidatorAsync: boolean;
	key: string;
	needsContext: boolean;
	needsStoreState: boolean;
	parsesParams: boolean;
}

/**
 * Analyzes an endpoint for dispatcher generation.
 */
const analyzeEndpoint = (app: Cudenix, endpoint: Endpoint): EndpointShape => {
	const chain = endpoint.chain;
	const chainLength = chain.length;
	const handler = endpoint.route.handler;
	const isSse = endpoint.route.sse;
	const isRouteAsync = !isSse && isAsync(handler);
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const hasValidator = validator !== undefined;
	const isValidatorAsync = hasValidator && isAsync(validator);
	const validatorTag = isValidatorAsync ? "Va" : "Vs";

	const asyncMap = new Array<boolean>(chainLength).fill(false);
	const awaitMap = new Array<boolean>(chainLength + 1).fill(false);
	const tags = new Array<string>(chainLength).fill("");

	let isChainAsync = isRouteAsync;
	let needsContext = usesContext(handler);
	let hasStore = false;
	let hasValidationState = false;
	let validatesParams = false;
	let emitsBelow = false;

	awaitMap[chainLength] = isChainAsync;

	for (let i = chainLength - 1; i >= 0; i--) {
		const link = chain[i];

		if (link?.type === "MIDDLEWARE" || link?.type === "STORE") {
			const isHandlerAsync = isAsync(link.handler);

			if (link.type === "STORE") {
				hasStore = true;
			}

			asyncMap[i] = isHandlerAsync;

			isChainAsync = isHandlerAsync || isChainAsync;

			if (!needsContext && usesContext(link.handler)) {
				needsContext = true;
			}

			tags[i] =
				link.type === "MIDDLEWARE"
					? `M${isChainAsync ? "1" : "0"}${awaitMap[i + 1] ? "1" : "0"}`
					: `S${isHandlerAsync ? "1" : "0"}`;

			emitsBelow = true;
		} else if (link?.type === "VALIDATOR" && hasValidator) {
			const keys: string[] = [];

			hasValidationState = true;

			for (let j = 0; j < link.keys.length; j++) {
				const key = link.keys[j];

				if (!key) {
					continue;
				}

				keys.push(key);

				if (key === "body") {
					isChainAsync = true;
				} else if (key === "params") {
					validatesParams = true;
				}
			}

			if (isValidatorAsync) {
				isChainAsync = true;
			}

			tags[i] = `${validatorTag}${JSON.stringify(keys)}`;

			emitsBelow = true;
		} else if (emitsBelow) {
			tags[i] = "_";
		}

		awaitMap[i] = isChainAsync;
	}

	let key = `${needsContext ? "1" : "0"}${hasValidationState ? "1" : "0"}${
		isSse ? "1" : "0"
	}${isRouteAsync ? "1" : "0"}${tags.join("")}`;

	const parsesParams =
		validatesParams || (needsContext && endpoint.paramKeys.length > 0);
	const needsStoreState = hasValidationState && hasStore && !needsContext;

	if (parsesParams && endpoint.paramKeys.length > 0) {
		const paramKeys = endpoint.paramKeys;
		const restKeys = endpoint.restKeys;

		let restBits = "";

		for (let i = 0; i < paramKeys.length; i++) {
			const paramKey = paramKeys[i];

			restBits +=
				paramKey !== undefined && restKeys.includes(paramKey)
					? "1"
					: "0";
		}

		key += `P${endpoint.matchOffset}${JSON.stringify(paramKeys)}${restBits}`;
	}

	return {
		asyncMap,
		awaitMap,
		hasValidationState,
		hasValidator,
		isChainAsync,
		isRouteAsync,
		isSse,
		isValidatorAsync,
		key,
		needsContext,
		needsStoreState,
		parsesParams,
	};
};

/**
 * Generates the request dispatcher body for an endpoint chain.
 */
const generateDispatcherBody = (
	chain: EndpointChain,
	parsers: Record<keyof ValidatorRequest, string>,
	shape: EndpointShape,
): string => {
	const {
		asyncMap,
		awaitMap,
		hasValidator,
		hasValidationState,
		isRouteAsync,
		isSse,
		isValidatorAsync,
		needsContext,
		needsStoreState,
	} = shape;

	const parsedKeys = new Set<keyof ValidatorRequest>();

	if (shape.parsesParams) {
		parsedKeys.add("params");
	}

	const linkArgument = needsContext ? "context" : "undefined";
	const routeArgument = needsContext ? "context" : "";
	const requestTarget = needsContext ? "context.request" : "validatedRequest";
	const contentTarget = needsContext ? "context.response.content" : "content";
	const returnStatement = needsContext
		? `return ${RESPONSE_CALL};`
		: "return response(content);";

	const terminate = (code: string, isNested: boolean): string =>
		isNested ? code : `${code}\n\n${returnStatement}`;

	const emit = (index: number, isNested: boolean): string => {
		if (index >= chain.length) {
			if (isSse) {
				const serverTarget = needsContext
					? "context.server"
					: hasValidationState
						? "server"
						: "app.server";
				const body = `${serverTarget}?.timeout(request, 0);

				${contentTarget} = stream(handler(${routeArgument}));`;

				return terminate(body, isNested);
			}

			const callCode = `${contentTarget} = ${isRouteAsync ? "await " : ""}handler(${routeArgument});`;

			return terminate(callCode, isNested);
		}

		const link = chain[index];

		if (link?.type === "MIDDLEWARE") {
			const isTailAsync = awaitMap[index + 1];
			const callCode = `const returned_${index} = ${awaitMap[index] ? "await " : ""}chain[${index}].handler(${linkArgument}, next_${index});`;

			const block = `{
			const next_${index} = ${isTailAsync ? "async " : ""}() => {
				${emit(index + 1, true)}
			};

			${callCode}

			if (returned_${index}) {
				${contentTarget} = returned_${index};
			}
		}`;

			return terminate(block, isNested);
		}

		if (link?.type === "STORE") {
			const callCode = `const returned_${index} = ${asyncMap[index] ? "await " : ""}chain[${index}].handler(${linkArgument});`;

			const shortCircuit = `${contentTarget} = returned_${index};\n\n\t\t\t\t${isNested ? "return;" : returnStatement}`;

			const storeTarget = needsContext
				? "context.store"
				: needsStoreState
					? "validatedStore"
					: "";
			const mergeStore = storeTarget
				? `

			if (returned_${index}) {
				merge(${storeTarget}, returned_${index});
			}`
				: "";

			return `{
			${callCode}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				${shortCircuit}
			}${mergeStore}
		}

		${emit(index + 1, isNested)}`;
		}

		if (link?.type === "VALIDATOR" && hasValidator) {
			let validationsCode = "";

			for (let i = 0; i < link.keys.length; i++) {
				const key = link.keys[i];

				if (!key) {
					continue;
				}

				let parserCode = "";

				if (!parsedKeys.has(key)) {
					parsedKeys.add(key);

					parserCode = parsers[key];
				}

				const keyLiteral = JSON.stringify(key);

				const validationCode = `{
					const validated = ${isValidatorAsync ? "await " : ""}validator(
						request_${index}[${keyLiteral}],
						${requestTarget}[${keyLiteral}],
						${keyLiteral},
					);

					if (validated.success) {
						${requestTarget}[${keyLiteral}] = validated.content;
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
				${contentTarget} = fail(errors_${index}, { status: 422 });

				${isNested ? "return;" : returnStatement}
			}
		}

		${emit(index + 1, isNested)}`;
		}

		return emit(index + 1, isNested);
	};

	return emit(0, false);
};

/**
 * Defines a compiled dispatcher factory.
 */
type DispatcherFactory = (
	app: Cudenix,
	Context: typeof import("@/core/context").Context,
	chain: EndpointChain,
	response: typeof import("@/core/response").response,
	Reply: typeof import("@/core/reply").Reply,
	merge: typeof import("@/utils/objects/merge").merge,
	Empty: typeof import("@/utils/objects/empty").Empty,
	fail: typeof import("@/core/reply").fail,
	stream: typeof import("@/core/sse").stream,
	parseBody: typeof import("@/utils/bodies/parse-body").parseBody,
	parseCookies: typeof import("@/utils/cookies/parse-cookies").parseCookies,
	parseQuery: typeof import("@/utils/urls/parse-query").parseQuery,
	decodePathParam: typeof import("@/utils/urls/decode-path-param").decodePathParam,
	validator: ValidatorPlugin | undefined,
	handler: Endpoint["route"]["handler"],
) => Dispatch;

/**
 * Defines the parameters injected into dispatcher factories.
 */
const FACTORY_PARAMETERS = [
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
	"decodePathParam",
	"validator",
	"handler",
] as const;

/**
 * Stores compiled dispatcher factories by endpoint shape.
 */
const factories = new Map<string, DispatcherFactory>();

/**
 * Compiles an endpoint into a request dispatcher.
 */
export const jit = (app: Cudenix, endpoint: Endpoint): Dispatch => {
	const shape = analyzeEndpoint(app, endpoint);

	let factory = factories.get(shape.key);

	if (factory === undefined) {
		const requestTarget = shape.needsContext
			? "context.request"
			: "validatedRequest";
		const parsers: Record<keyof ValidatorRequest, string> = {
			body: `${requestTarget}.body = await parseBody(request);`,
			cookies: `${requestTarget}.cookies = parseCookies(request.headers.get("cookie") ?? "");`,
			headers: `${requestTarget}.headers = request.headers.toJSON();`,
			params: shape.parsesParams
				? generateParamsParser(
						endpoint.paramKeys,
						endpoint.matchOffset,
						endpoint.restKeys,
						`${requestTarget}.params`,
					)
				: "",
			query: `${requestTarget}.query = parseQuery(request.url);`,
		};
		const bunDetection = 'const isBun = "cookies" in request;';
		const preludeStatements = shape.needsContext
			? [
					"const context = new Context(app, request, match);",
					bunDetection,
				]
			: ["let content;"];

		if (!shape.needsContext) {
			if (shape.isSse && shape.hasValidationState) {
				preludeStatements.push("const server = app.server;");
			}

			if (shape.hasValidationState) {
				preludeStatements.push("const validatedRequest = new Empty();");
			}

			if (shape.needsStoreState) {
				preludeStatements.push("const validatedStore = new Empty();");
			}

			if (shape.parsesParams) {
				preludeStatements.push(bunDetection);
			}
		}

		if (shape.parsesParams) {
			preludeStatements.push(parsers.params);
		}

		const prelude = `\n${preludeStatements.join("\n\n")}\n\n`;

		const body = generateDispatcherBody(endpoint.chain, parsers, shape);

		const source = `return ${shape.isChainAsync ? "async " : ""}function (request, match) {${prelude}${body}\n};`;

		factory = new Function(
			...FACTORY_PARAMETERS,
			source,
		) as DispatcherFactory;

		factories.set(shape.key, factory);
	}

	return factory(
		app,
		Context,
		endpoint.chain,
		response,
		Reply,
		merge,
		Empty,
		fail,
		stream,
		parseBody,
		parseCookies,
		parseQuery,
		decodePathParam,
		app.memory.validator as ValidatorPlugin | undefined,
		endpoint.route.handler,
	);
};
