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

const VALIDATION_KEYS = [
	"body",
	"cookies",
	"headers",
	"params",
	"query",
] as const satisfies readonly (keyof ValidatorRequest)[];

interface FactoryDependencyValues {
	app: Cudenix;
	Context: typeof Context;
	chain: EndpointChain;
	decodePathParam: typeof decodePathParam;
	Empty: typeof Empty;
	fail: typeof fail;
	handler: Endpoint["route"]["handler"];
	merge: typeof merge;
	parseBody: typeof parseBody;
	parseCookies: typeof parseCookies;
	parseQuery: typeof parseQuery;
	Reply: typeof Reply;
	response: typeof response;
	stream: typeof stream;
	validator: ValidatorPlugin | undefined;
}

export type FactoryDependencyName = keyof FactoryDependencyValues;

type FactoryDependencyValue = FactoryDependencyValues[FactoryDependencyName];

type LinkFactoryDependency = <Name extends FactoryDependencyName>(
	name: Name,
) => Name;

const createDependencyLinker = () => {
	const dependencies: FactoryDependencyName[] = [];
	const linked = new Set<FactoryDependencyName>();
	const link: LinkFactoryDependency = (name) => {
		if (!linked.has(name)) {
			linked.add(name);
			dependencies.push(name);
		}

		return name;
	};

	return { dependencies, link };
};

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
	link: LinkFactoryDependency,
): string => {
	const EmptyName = link("Empty");

	if (paramKeys.length === 0) {
		return `let params=request.params;if(!params){params=new ${EmptyName}()}${target}=params;`;
	}

	const decodePathParamName = link("decodePathParam");

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
		const decodedValue = `${decodePathParamName}(${valueExpression})`;
		const paramValueExpression = isRest
			? `${decodedValue}.split("/")`
			: decodedValue;

		assignmentsCode += isOptional
			? `const ${valueName}=match[${matchGroupIndex}];if(${valueName}!==undefined){params[${keyLiteral}]=${paramValueExpression}}`
			: `params[${keyLiteral}]=${paramValueExpression};`;
	}

	// A matched dispatch without Bun params always comes from the regexp fallback.
	return `let params=request.params;if(!params){params=new ${EmptyName}();${assignmentsCode}}${target}=params;`;
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
	needsMatch: boolean;
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
	const needsMatch = parsesParams && endpoint.paramKeys.length > 0;
	const needsStoreState = hasValidationState && hasStore && !needsContext;

	key += "G";

	if (needsMatch) {
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
		needsMatch,
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
	parsers: Record<keyof ValidatorRequest, () => string>,
	shape: EndpointShape,
	link: LinkFactoryDependency,
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
	const responseName = link("response");
	const returnStatement = needsContext
		? `return ${responseName}(context.response.content,context.response.cookies,context.response.headers);`
		: `return ${responseName}(content);`;
	const terminate = (code: string, isNested: boolean): string =>
		isNested ? code : `${code}${returnStatement}`;
	const slotTarget = (key: keyof ValidatorRequest): string =>
		needsContext ? `context.request.${key}` : getValidatedLocal(key);

	const emit = (index: number, isNested: boolean): string => {
		if (index >= chain.length) {
			const handlerName = link("handler");

			if (isSse) {
				const serverTarget = needsContext
					? "context.server"
					: hasValidationState
						? "server"
						: `${link("app")}.server`;

				return terminate(
					`${serverTarget}?.timeout(request,0);${contentTarget}=${link("stream")}(${handlerName}(${routeArgument}));`,
					isNested,
				);
			}

			return terminate(
				`${contentTarget}=${isRouteAsync ? "await " : ""}${handlerName}(${routeArgument});`,
				isNested,
			);
		}

		const chainLink = chain[index];

		if (chainLink?.type === "MIDDLEWARE") {
			const isTailAsync = awaitMap[index + 1];
			const block = `{const next_${index}=${isTailAsync ? "async " : ""}()=>{${emit(index + 1, true)}};const returned_${index}=${awaitMap[index] ? "await " : ""}${link("chain")}[${index}].handler(${linkArgument},next_${index});if(returned_${index}){${contentTarget}=returned_${index}}}`;

			return terminate(block, isNested);
		}

		if (chainLink?.type === "STORE") {
			const call = `const returned_${index}=${asyncMap[index] ? "await " : ""}${link("chain")}[${index}].handler(${linkArgument});`;
			const shortCircuit = `${contentTarget}=returned_${index};${isNested ? "return;" : returnStatement}`;
			const storeTarget = needsContext
				? "context.store"
				: needsStoreState
					? "validatedStore"
					: "";
			const mergeStore = storeTarget
				? `if(returned_${index}){${link("merge")}(${storeTarget},returned_${index})}`
				: "";

			return `{${call}if(returned_${index} instanceof ${link("Reply")}&&!returned_${index}.success){${shortCircuit}}${mergeStore}}${emit(index + 1, isNested)}`;
		}

		if (
			chainLink?.type === "VALIDATOR" &&
			hasValidationState &&
			hasValidationKeys(chainLink.keys)
		) {
			const keys: (keyof ValidatorRequest)[] = [];

			for (let i = 0; i < chainLink.keys.length; i++) {
				const key = chainLink.keys[i];

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
					validations += parsers[key]();
				}

				validations += `{const validated=${isValidatorAsync ? "await " : ""}${link("validator")}(${requestTarget}.${key},${target},${keyLiteral});if(validated.success){${target}=validated.content}else{(${errorTarget}??=new ${link("Empty")}()).${key}=validated.content}}`;
			}

			const failure = `${contentTarget}=${link("fail")}(${errorTarget},{status:422});${isNested ? "return;" : returnStatement}`;

			return `{const ${requestTarget}=${link("chain")}[${index}].request;let ${errorTarget};${validations}if(${errorTarget}){${failure}}}${emit(index + 1, isNested)}`;
		}

		return emit(index + 1, isNested);
	};

	return emit(0, false);
};

/**
 * Defines a compiled dispatcher factory.
 */
type DispatcherFactory = (...values: FactoryDependencyValue[]) => Dispatch;

interface DispatcherFactoryEntry {
	dependencies: FactoryDependencyName[];
	factory: DispatcherFactory;
}

const resolveFactoryDependency = (
	name: FactoryDependencyName,
	app: Cudenix,
	endpoint: Endpoint,
	validator: ValidatorPlugin | undefined,
): FactoryDependencyValue => {
	switch (name) {
		case "app":
			return app;
		case "Context":
			return Context;
		case "chain":
			return endpoint.chain;
		case "response":
			return response;
		case "Reply":
			return Reply;
		case "merge":
			return merge;
		case "Empty":
			return Empty;
		case "fail":
			return fail;
		case "stream":
			return stream;
		case "parseBody":
			return parseBody;
		case "parseCookies":
			return parseCookies;
		case "parseQuery":
			return parseQuery;
		case "decodePathParam":
			return decodePathParam;
		case "validator":
			return validator;
		case "handler":
			return endpoint.route.handler;
	}
};

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

const createDispatcherFactoryPlan = (
	endpoint: Endpoint,
	shape: EndpointShape,
) => {
	const { dependencies, link } = createDependencyLinker();
	const slotTarget = (key: keyof ValidatorRequest) =>
		shape.needsContext ? `context.request.${key}` : getValidatedLocal(key);
	const parsers: Record<keyof ValidatorRequest, () => string> = {
		body: () =>
			`${slotTarget("body")}=await ${link("parseBody")}(request);`,
		cookies: () =>
			`${slotTarget("cookies")}=${link("parseCookies")}(request.headers.get("cookie")??"");`,
		headers: () => `${slotTarget("headers")}=request.headers.toJSON();`,
		params: () =>
			shape.parsesParams
				? generateParamsParser(
						endpoint.paramKeys,
						endpoint.paramFlags,
						endpoint.matchOffset,
						endpoint.restKeys,
						slotTarget("params"),
						link,
					)
				: "",
		query: () =>
			`${slotTarget("query")}=${link("parseQuery")}(request.url);`,
	};
	const preludeStatements = shape.needsContext
		? [`const context=new ${link("Context")}(${link("app")},request);`]
		: ["let content;"];

	if (!shape.needsContext) {
		if (shape.isSse && shape.hasValidationState) {
			preludeStatements.push(`const server=${link("app")}.server;`);
		}

		if (shape.validationKeys.length > 0) {
			preludeStatements.push(
				`let ${shape.validationKeys.map(slotTarget).join(",")};`,
			);
		}

		if (shape.needsStoreState) {
			preludeStatements.push(
				`const validatedStore=new ${link("Empty")}();`,
			);
		}
	}

	if (shape.needsContext && shape.parsesParams) {
		preludeStatements.push(parsers.params());
	}

	const body = generateDispatcherBody(endpoint.chain, parsers, shape, link);
	const parameters = shape.needsMatch ? "request,match" : "request";
	const source = `return ${shape.isChainAsync ? "async " : ""}function(${parameters}){${preludeStatements.join("")}${body}}`;

	return { dependencies, source };
};

/**
 * Returns the exact dependency names linked by a generated dispatcher factory.
 *
 * @internal
 */
export const inspectJitFactoryDependencies = (
	app: Cudenix,
	endpoint: Endpoint,
): readonly FactoryDependencyName[] => {
	const handler = endpoint.route.handler;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const handlerUsesContext = usesContext(handler);

	if (
		!endpoint.route.sse &&
		!handlerUsesContext &&
		!hasEffectiveChain(endpoint.chain, validator !== undefined)
	) {
		return ["response", "handler"];
	}

	const shape = analyzeEndpoint(endpoint, validator, handlerUsesContext);

	return createDispatcherFactoryPlan(endpoint, shape).dependencies;
};

/**
 * Stores compiled dispatcher factories by endpoint shape.
 */
const factories = new Map<string, DispatcherFactoryEntry>();

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

	let entry = factories.get(shape.key);

	if (entry === undefined) {
		const plan = createDispatcherFactoryPlan(endpoint, shape);
		const factory = new Function(
			...plan.dependencies,
			plan.source,
		) as DispatcherFactory;

		entry = { dependencies: plan.dependencies, factory };
		factories.set(shape.key, entry);
	}

	const values = new Array<FactoryDependencyValue>(entry.dependencies.length);

	for (let i = 0; i < entry.dependencies.length; i++) {
		const dependency = entry.dependencies[i];

		if (dependency === undefined) {
			continue;
		}

		values[i] = resolveFactoryDependency(
			dependency,
			app,
			endpoint,
			validator,
		);
	}

	return entry.factory(...values);
};
