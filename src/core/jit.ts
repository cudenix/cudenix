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
import {
	PARAM_FLAG_OPTIONAL,
	PARAM_FLAG_REST,
} from "@/utils/regexps/path-to-regexp";
import { decodePathParam } from "@/utils/urls/decode-path-param";
import { parseQuery } from "@/utils/urls/parse-query";

/**
 * Defines the response call used by full-context dispatchers.
 */
const RESPONSE_CALL =
	"response(context.response.content,context.response.cookies,context.response.headers)";

const VALIDATION_KEYS = [
	"body",
	"cookies",
	"headers",
	"params",
	"query",
] as const satisfies readonly (keyof ValidatorRequest)[];

/**
 * Returns the generated local name for a request validation slot.
 */
const getValidatedLocal = (key: keyof ValidatorRequest) =>
	`validated${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/**
 * Returns whether a validator link has at least one executable request slot.
 */
const hasValidationKeys = (
	keys: readonly (keyof ValidatorRequest | undefined)[],
) => {
	for (let i = 0; i < keys.length; i++) {
		if (keys[i]) {
			return true;
		}
	}

	return false;
};

/**
 * Returns whether an endpoint chain contains any link that executes.
 */
const hasEffectiveChain = (chain: EndpointChain, hasValidator: boolean) => {
	for (let i = 0; i < chain.length; i++) {
		const link = chain[i];

		if (
			link?.type === "MIDDLEWARE" ||
			link?.type === "STORE" ||
			(link?.type === "VALIDATOR" &&
				hasValidator &&
				hasValidationKeys(link.keys))
		) {
			return true;
		}
	}

	return false;
};

/**
 * Generates the path parameter parser for a dispatcher.
 */
const generateParamsParser = (
	paramKeys: string[],
	paramFlags: number[] | undefined,
	matchOffset: number,
	restKeys: string[],
	target: string,
): string => {
	if (paramKeys.length === 0) {
		return `let params=request.params;if(!params){params=new Empty()}${target}=params;`;
	}

	let assignmentsCode = "";

	for (let i = 0; i < paramKeys.length; i++) {
		const paramKey = paramKeys[i];

		if (paramKey === undefined) {
			continue;
		}

		const matchGroupIndex = matchOffset + 1 + i;
		const keyLiteral = JSON.stringify(paramKey);
		const valueName = `value_${i}`;
		const flags = paramFlags?.[i];
		const isOptional =
			flags === undefined || (flags & PARAM_FLAG_OPTIONAL) !== 0;
		const isRest =
			flags === undefined
				? restKeys.includes(paramKey)
				: (flags & PARAM_FLAG_REST) !== 0;
		const valueExpression = isOptional
			? valueName
			: `match[${matchGroupIndex}]`;
		const decodedValue = `decodePathParam(${valueExpression})`;
		const paramValueExpression = isRest
			? `${decodedValue}.split("/")`
			: decodedValue;

		assignmentsCode += isOptional
			? `const ${valueName}=match[${matchGroupIndex}];if(${valueName}!==undefined){params[${keyLiteral}]=${paramValueExpression}}`
			: `params[${keyLiteral}]=${paramValueExpression};`;
	}

	// A matched dispatch without Bun params always comes from the regexp fallback.
	return `let params=request.params;if(!params){params=new Empty();${assignmentsCode}}${target}=params;`;
};

/**
 * Describes the shape used to generate an endpoint dispatcher.
 */
interface EndpointShape {
	asyncMap: boolean[];
	awaitMap: boolean[];
	hasValidationState: boolean;
	isChainAsync: boolean;
	isRouteAsync: boolean;
	isSse: boolean;
	isValidatorAsync: boolean;
	key: string;
	needsContext: boolean;
	needsStoreState: boolean;
	parsesParams: boolean;
	validationKeys: (keyof ValidatorRequest)[];
}

/**
 * Analyzes an endpoint for dispatcher generation.
 */
const analyzeEndpoint = (
	endpoint: Endpoint,
	validator: ValidatorPlugin | undefined,
	handlerUsesContext: boolean,
): EndpointShape => {
	const chain = endpoint.chain;
	const chainLength = chain.length;
	const handler = endpoint.route.handler;
	const isSse = endpoint.route.sse;
	const isRouteAsync = !isSse && isAsync(handler);
	const hasValidator = validator !== undefined;
	const isValidatorAsync = hasValidator && isAsync(validator);
	const validatorTag = isValidatorAsync ? "Va" : "Vs";

	const asyncMap = new Array<boolean>(chainLength).fill(false);
	const awaitMap = new Array<boolean>(chainLength + 1).fill(false);
	const tags = new Array<string>(chainLength).fill("");
	const validationKeySet = new Set<keyof ValidatorRequest>();

	let isChainAsync = isRouteAsync;
	let needsContext = handlerUsesContext;
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
		} else if (
			link?.type === "VALIDATOR" &&
			hasValidator &&
			hasValidationKeys(link.keys)
		) {
			const keys: (keyof ValidatorRequest)[] = [];

			for (let j = 0; j < link.keys.length; j++) {
				const key = link.keys[j];

				if (!key) {
					continue;
				}

				keys.push(key);
				validationKeySet.add(key);

				if (key === "body") {
					isChainAsync = true;
				} else if (key === "params") {
					validatesParams = true;
				}
			}

			hasValidationState = true;

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

	key += "G";

	if (parsesParams && endpoint.paramKeys.length > 0) {
		const paramFlags = endpoint.paramFlags;
		const paramKeys = endpoint.paramKeys;
		const restKeys = endpoint.restKeys;

		let optionalBits = "";
		let restBits = "";

		for (let i = 0; i < paramKeys.length; i++) {
			const paramKey = paramKeys[i];

			const flags = paramKey === undefined ? 0 : paramFlags?.[i];
			const isOptional =
				flags === undefined || (flags & PARAM_FLAG_OPTIONAL) !== 0;
			const isRest =
				flags === undefined
					? paramKey !== undefined && restKeys.includes(paramKey)
					: (flags & PARAM_FLAG_REST) !== 0;

			optionalBits += isOptional ? "1" : "0";
			restBits += isRest ? "1" : "0";
		}

		key += `P${endpoint.matchOffset}${JSON.stringify(paramKeys)}O${optionalBits}R${restBits}`;
	}

	return {
		asyncMap,
		awaitMap,
		hasValidationState,
		isChainAsync,
		isRouteAsync,
		isSse,
		isValidatorAsync,
		key,
		needsContext,
		needsStoreState,
		parsesParams,
		validationKeys: VALIDATION_KEYS.filter((key) =>
			validationKeySet.has(key),
		),
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
		hasValidationState,
		isRouteAsync,
		isSse,
		isValidatorAsync,
		needsContext,
		needsStoreState,
	} = shape;
	const parsedKeys = new Set<keyof ValidatorRequest>();

	if (needsContext && shape.parsesParams) {
		parsedKeys.add("params");
	}

	const linkArgument = needsContext ? "context" : "undefined";
	const routeArgument = needsContext ? "context" : "";
	const contentTarget = needsContext ? "context.response.content" : "content";
	const returnStatement = needsContext
		? `return ${RESPONSE_CALL};`
		: "return response(content);";
	const terminate = (code: string, isNested: boolean): string =>
		isNested ? code : `${code}${returnStatement}`;
	const slotTarget = (key: keyof ValidatorRequest): string =>
		needsContext ? `context.request.${key}` : getValidatedLocal(key);

	const emit = (index: number, isNested: boolean): string => {
		if (index >= chain.length) {
			if (isSse) {
				const serverTarget = needsContext
					? "context.server"
					: hasValidationState
						? "server"
						: "app.server";

				return terminate(
					`${serverTarget}?.timeout(request,0);${contentTarget}=stream(handler(${routeArgument}));`,
					isNested,
				);
			}

			return terminate(
				`${contentTarget}=${isRouteAsync ? "await " : ""}handler(${routeArgument});`,
				isNested,
			);
		}

		const link = chain[index];

		if (link?.type === "MIDDLEWARE") {
			const isTailAsync = awaitMap[index + 1];
			const block = `{const next_${index}=${isTailAsync ? "async " : ""}()=>{${emit(index + 1, true)}};const returned_${index}=${awaitMap[index] ? "await " : ""}chain[${index}].handler(${linkArgument},next_${index});if(returned_${index}){${contentTarget}=returned_${index}}}`;

			return terminate(block, isNested);
		}

		if (link?.type === "STORE") {
			const call = `const returned_${index}=${asyncMap[index] ? "await " : ""}chain[${index}].handler(${linkArgument});`;
			const shortCircuit = `${contentTarget}=returned_${index};${isNested ? "return;" : returnStatement}`;
			const storeTarget = needsContext
				? "context.store"
				: needsStoreState
					? "validatedStore"
					: "";
			const mergeStore = storeTarget
				? `if(returned_${index}){merge(${storeTarget},returned_${index})}`
				: "";

			return `{${call}if(returned_${index} instanceof Reply&&!returned_${index}.success){${shortCircuit}}${mergeStore}}${emit(index + 1, isNested)}`;
		}

		if (
			link?.type === "VALIDATOR" &&
			hasValidationState &&
			hasValidationKeys(link.keys)
		) {
			const keys: (keyof ValidatorRequest)[] = [];

			for (let i = 0; i < link.keys.length; i++) {
				const key = link.keys[i];

				if (key) {
					keys.push(key);
				}
			}

			const errorTarget = `errors_${index}`;
			const requestTarget = `request_${index}`;
			let validations = "";

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]!;
				const target = slotTarget(key);
				const keyLiteral = JSON.stringify(key);

				if (!parsedKeys.has(key)) {
					parsedKeys.add(key);
					validations +=
						key === "body"
							? `${target}=await parseBody(request);`
							: parsers[key];
				}

				validations += `{const validated=${isValidatorAsync ? "await " : ""}validator(${requestTarget}.${key},${target},${keyLiteral});if(validated.success){${target}=validated.content}else{(${errorTarget}??=new Empty()).${key}=validated.content}}`;
			}

			const failure = `${contentTarget}=fail(${errorTarget},{status:422});${isNested ? "return;" : returnStatement}`;

			return `{const ${requestTarget}=chain[${index}].request;let ${errorTarget};${validations}if(${errorTarget}){${failure}}}${emit(index + 1, isNested)}`;
		}

		return emit(index + 1, isNested);
	};

	return emit(0, false);
};

/**
 * Defines a compiled dispatcher factory.
 */
type DispatcherFactory = (
	appValue: Cudenix,
	ContextValue: typeof Context,
	chainValue: EndpointChain,
	responseValue: typeof response,
	ReplyValue: typeof Reply,
	mergeValue: typeof merge,
	EmptyValue: typeof Empty,
	failValue: typeof fail,
	streamValue: typeof stream,
	parseBodyValue: typeof parseBody,
	parseCookiesValue: typeof parseCookies,
	parseQueryValue: typeof parseQuery,
	decodePathParamValue: typeof decodePathParam,
	validatorValue: ValidatorPlugin | undefined,
	handlerValue: Endpoint["route"]["handler"],
) => Dispatch;

/**
 * Canonicalizes the positional dependencies injected into generated factories.
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

type DirectSyncFactory = (
	responseFn: typeof response,
	handler: Endpoint["route"]["handler"],
) => Dispatch;

type DirectAsyncFactory = (
	responseFn: typeof response,
	handler: Endpoint["route"]["handler"],
) => Dispatch;

const directSyncFactory = new Function(
	"response",
	"handler",
	"return function(){return response(handler())}",
) as DirectSyncFactory;

const directAsyncFactory = new Function(
	"response",
	"handler",
	"return async function(){return response(await handler())}",
) as DirectAsyncFactory;

/**
 * Stores compiled dispatcher factories by endpoint shape.
 */
const factories = new Map<string, DispatcherFactory>();

/**
 * Compiles an endpoint into a request dispatcher.
 */
export const jit = (app: Cudenix, endpoint: Endpoint): Dispatch => {
	const handler = endpoint.route.handler;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const handlerUsesContext = usesContext(handler);

	if (
		!endpoint.route.sse &&
		!handlerUsesContext &&
		!hasEffectiveChain(endpoint.chain, validator !== undefined)
	) {
		return isAsync(handler)
			? directAsyncFactory(response, handler)
			: directSyncFactory(response, handler);
	}

	const shape = analyzeEndpoint(endpoint, validator, handlerUsesContext);

	let factory = factories.get(shape.key);

	if (factory === undefined) {
		const slotTarget = (key: keyof ValidatorRequest) =>
			shape.needsContext
				? `context.request.${key}`
				: getValidatedLocal(key);
		const parsers: Record<keyof ValidatorRequest, string> = {
			body: "",
			cookies: `${slotTarget("cookies")}=parseCookies(request.headers.get("cookie")??"");`,
			headers: `${slotTarget("headers")}=request.headers.toJSON();`,
			params: shape.parsesParams
				? generateParamsParser(
						endpoint.paramKeys,
						endpoint.paramFlags,
						endpoint.matchOffset,
						endpoint.restKeys,
						slotTarget("params"),
					)
				: "",
			query: `${slotTarget("query")}=parseQuery(request.url);`,
		};
		const preludeStatements = shape.needsContext
			? ["const context=new Context(app,request);"]
			: ["let content;"];

		if (!shape.needsContext) {
			if (shape.isSse && shape.hasValidationState) {
				preludeStatements.push("const server=app.server;");
			}

			if (shape.validationKeys.length > 0) {
				preludeStatements.push(
					`let ${shape.validationKeys.map(slotTarget).join(",")};`,
				);
			}

			if (shape.needsStoreState) {
				preludeStatements.push("const validatedStore=new Empty();");
			}
		}

		if (shape.needsContext && shape.parsesParams) {
			preludeStatements.push(parsers.params);
		}

		const body = generateDispatcherBody(endpoint.chain, parsers, shape);
		const source = `return ${shape.isChainAsync ? "async " : ""}function(request,match){${preludeStatements.join("")}${body}}`;
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
		validator,
		handler,
	);
};
