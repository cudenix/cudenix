import { analyzeHandler, type HandlerAnalysis } from "@/core/analyzer";
import type { Cudenix, Endpoint, EndpointChain } from "@/core/cudenix";
import { fail, Reply } from "@/core/reply";
import { response } from "@/core/response";
import { stream } from "@/core/sse";
import type { ValidatorPlugin, ValidatorRequest } from "@/core/validator";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { isAsync } from "@/utils/functions/is-async";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";
import {
	PARAM_FLAG_OPTIONAL,
	PARAM_FLAG_REST,
} from "@/utils/regexps/path-to-regexp";
import { decodePathParam } from "@/utils/urls/decode-path-param";
import { parseQuery } from "@/utils/urls/parse-query";

/**
 * Request validation slots in the order generated dispatchers declare them.
 */
const VALIDATION_KEYS = [
	"body",
	"cookies",
	"headers",
	"params",
	"query",
] as const satisfies readonly (keyof ValidatorRequest)[];

/**
 * Maps each dependency name to the value a dispatcher factory receives.
 */
interface FactoryDependencyValues {
	app: Cudenix;
	CookieMap: typeof Bun.CookieMap;
	chain: EndpointChain;
	decodePathParam: typeof decodePathParam;
	Empty: typeof Empty;
	fail: typeof fail;
	Headers: typeof Headers;
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

/**
 * Any dependency name a dispatcher factory can receive.
 */
type FactoryDependencyName = keyof FactoryDependencyValues;

/**
 * Any value a dispatcher factory can receive.
 */
type FactoryDependencyValue = FactoryDependencyValues[FactoryDependencyName];

/**
 * Describes the linker that records a dependency and returns its name.
 */
type LinkFactoryDependency = <Name extends FactoryDependencyName>(
	name: Name,
) => Name;

/**
 * Describes the prebuilt factory for a route that needs no generated dispatcher.
 */
type DirectFactory = (
	responseFn: typeof response,
	handler: Endpoint["route"]["handler"],
) => Endpoint["dispatch"];

/**
 * Defines a compiled dispatcher factory.
 */
type DispatcherFactory = (
	...values: FactoryDependencyValue[]
) => Endpoint["dispatch"];

/**
 * Pairs a compiled factory with the dependency order it expects.
 */
interface DispatcherFactoryEntry {
	dependencies: FactoryDependencyName[];
	factory: DispatcherFactory;
}

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
	needsMemory: boolean;
	needsRequest: boolean;
	needsResponseContent: boolean;
	needsResponseCookies: boolean;
	needsResponseHeaders: boolean;
	needsResponseMetadata: boolean;
	needsServer: boolean;
	needsStore: boolean;
	needsStoreState: boolean;
	parsesParams: boolean;
	validationKeys: (keyof ValidatorRequest)[];
}

/**
 * Renders a shape flag as a cache key bit.
 */
const bit = (flag: boolean | undefined) => (flag ? "1" : "0");

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
 * Collects the executable request slots of a validator link, in declared order.
 */
const collectValidationKeys = (
	keys: readonly (keyof ValidatorRequest | undefined)[],
) => {
	const collected: (keyof ValidatorRequest)[] = [];

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];

		if (key) {
			collected.push(key);
		}
	}

	return collected;
};

/**
 * Returns whether a parameter is optional; missing flags assume the loosest
 * layout.
 */
const isOptionalParam = (flags: number | undefined) =>
	flags === undefined || (flags & PARAM_FLAG_OPTIONAL) !== 0;

/**
 * Returns whether a parameter is a rest segment; missing flags fall back to the
 * resolved rest keys.
 */
const isRestParam = (
	flags: number | undefined,
	paramKey: string | undefined,
	restKeys: string[],
) =>
	flags === undefined
		? paramKey !== undefined && restKeys.includes(paramKey)
		: (flags & PARAM_FLAG_REST) !== 0;

/**
 * Builds the dispatcher for a sync route with no context and no chain.
 */
const directSyncFactory = new Function(
	"response",
	"handler",
	"return function(){return response(handler())}",
) as DirectFactory;

/**
 * Builds the dispatcher for an async route with no context and no chain.
 */
const directAsyncFactory = new Function(
	"response",
	"handler",
	"return async function(){return response(await handler())}",
) as DirectFactory;

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
 * Returns whether an endpoint needs no generated dispatcher.
 */
const isDirectDispatch = (
	endpoint: Endpoint,
	handlerAnalysis: HandlerAnalysis,
	hasValidator: boolean,
) =>
	!endpoint.route.sse &&
	!handlerAnalysis.needsContext &&
	!hasEffectiveChain(endpoint.chain, hasValidator);

/**
 * Builds the parameter layout suffix of a cache key.
 */
const buildParamLayoutKey = (endpoint: Endpoint) => {
	const paramFlags = endpoint.paramFlags;
	const paramKeys = endpoint.paramKeys;
	const restKeys = endpoint.restKeys;

	let optionalBits = "";
	let restBits = "";

	for (let i = 0; i < paramKeys.length; i++) {
		const paramKey = paramKeys[i];
		// A hole in the key list carries no layout of its own.
		const flags = paramKey === undefined ? 0 : paramFlags?.[i];

		optionalBits += bit(isOptionalParam(flags));
		restBits += bit(isRestParam(flags, paramKey, restKeys));
	}

	return `P${endpoint.matchOffset}${JSON.stringify(paramKeys)}O${optionalBits}R${restBits}`;
};

/**
 * Analyzes an endpoint for dispatcher generation.
 */
const analyzeEndpoint = (
	endpoint: Endpoint,
	validator: ValidatorPlugin | undefined,
	handlerAnalysis: HandlerAnalysis,
): EndpointShape => {
	const chain = endpoint.chain;
	const chainLength = chain.length;
	const isSse = endpoint.route.sse;
	// An SSE handler is a generator, so its iterator is never awaited.
	const isRouteAsync = !isSse && handlerAnalysis.isAsync;
	const hasValidator = validator !== undefined;
	const isValidatorAsync = hasValidator && isAsync(validator);
	const validatorTag = isValidatorAsync ? "Va" : "Vs";

	const asyncMap = new Array<boolean>(chainLength).fill(false);
	// The extra slot is the route handler tail.
	const awaitMap = new Array<boolean>(chainLength + 1).fill(false);
	const tags = new Array<string>(chainLength).fill("");
	const validationKeySet = new Set<keyof ValidatorRequest>();

	let isChainAsync = isRouteAsync;
	let needsContext = handlerAnalysis.needsContext;
	let needsMemory = handlerAnalysis.needsMemory;
	let needsRequest = handlerAnalysis.needsRequest;
	let needsResponseContent = handlerAnalysis.needsResponseContent;
	let needsResponseCookies = handlerAnalysis.needsResponseCookies;
	let needsResponseHeaders = handlerAnalysis.needsResponseHeaders;
	let needsServer = handlerAnalysis.needsServer;
	let needsStore = handlerAnalysis.needsStore;
	let hasStore = false;
	let hasValidationState = false;
	let validatesParams = false;
	let emitsBelow = false;

	awaitMap[chainLength] = isChainAsync;

	// Walked backwards so each link sees whether its tail awaits.
	for (let i = chainLength - 1; i >= 0; i--) {
		const link = chain[i];

		if (link?.type === "MIDDLEWARE" || link?.type === "STORE") {
			const linkAnalysis = analyzeHandler(link.handler);
			const isHandlerAsync = linkAnalysis.isAsync;

			if (link.type === "STORE") {
				hasStore = true;
			}

			asyncMap[i] = isHandlerAsync;

			isChainAsync = isHandlerAsync || isChainAsync;

			if (linkAnalysis.needsContext) {
				needsContext = true;
				needsMemory ||= linkAnalysis.needsMemory;
				needsRequest ||= linkAnalysis.needsRequest;
				needsResponseContent ||= linkAnalysis.needsResponseContent;
				needsResponseCookies ||= linkAnalysis.needsResponseCookies;
				needsResponseHeaders ||= linkAnalysis.needsResponseHeaders;
				needsServer ||= linkAnalysis.needsServer;
				needsStore ||= linkAnalysis.needsStore;
			}

			// The middleware tag reads isChainAsync after this link folded into it.
			tags[i] =
				link.type === "MIDDLEWARE"
					? `M${bit(isChainAsync)}${bit(awaitMap[i + 1])}`
					: `S${bit(isHandlerAsync)}`;

			emitsBelow = true;
		} else if (
			link?.type === "VALIDATOR" &&
			hasValidator &&
			hasValidationKeys(link.keys)
		) {
			const keys = collectValidationKeys(link.keys);

			for (let j = 0; j < keys.length; j++) {
				const key = keys[j]!;

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
			// The placeholder keeps chain indices stable in the cache key.
			tags[i] = "_";
		}

		// Runs for every index, including links that emit nothing.
		awaitMap[i] = isChainAsync;
	}

	const needsResponseMetadata =
		needsResponseContent || needsResponseCookies || needsResponseHeaders;

	if (needsContext) {
		needsRequest ||= hasValidationState;
		needsRequest ||= endpoint.paramKeys.length > 0;
		needsServer ||= isSse;
		// A store merge needs the object even when no handler reads it.
		needsStore ||= hasStore;
	}

	const parsesParams =
		validatesParams || (needsContext && endpoint.paramKeys.length > 0);
	const needsMatch = parsesParams && endpoint.paramKeys.length > 0;
	const needsStoreState = hasValidationState && hasStore && !needsContext;

	// Key layout: context flag, ten shape bits, the chain tags, then "G" to close
	// them before the optional parameter layout.
	const key = `${needsContext ? "C" : "N"}${bit(needsMemory)}${bit(needsRequest)}${bit(needsResponseContent)}${bit(needsResponseCookies)}${bit(needsResponseHeaders)}${bit(needsServer)}${bit(needsStore)}${bit(hasValidationState)}${bit(isSse)}${bit(isRouteAsync)}${tags.join("")}G${needsMatch ? buildParamLayoutKey(endpoint) : ""}`;

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
		needsMemory,
		needsRequest,
		needsResponseContent,
		needsResponseCookies,
		needsResponseHeaders,
		needsResponseMetadata,
		needsServer,
		needsStore,
		needsStoreState,
		parsesParams,
		validationKeys: VALIDATION_KEYS.filter((validationKey) =>
			validationKeySet.has(validationKey),
		),
	};
};

/**
 * Creates a linker that records each dependency once, in factory parameter order.
 */
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
 * Returns where a dispatcher keeps a validated request slot.
 */
const getSlotTarget = (needsContext: boolean, key: keyof ValidatorRequest) =>
	needsContext ? `context.request.${key}` : getValidatedLocal(key);

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
		const isOptional = isOptionalParam(flags);
		const isRest = isRestParam(flags, paramKey, restKeys);
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
		needsResponseContent,
		needsResponseCookies,
		needsResponseHeaders,
		needsStoreState,
		parsesParams,
	} = shape;
	const parsedKeys = new Set<keyof ValidatorRequest>();

	if (needsContext && parsesParams) {
		// The prelude already parsed params for a context dispatcher.
		parsedKeys.add("params");
	}

	// Without context a link still takes an explicit undefined; the route takes nothing.
	const linkArgument = needsContext ? "context" : "undefined";
	const routeArgument = needsContext ? "context" : "";
	const contentTarget = needsResponseContent
		? "context.response.content"
		: "content";
	const responseName = link("response");
	const responseArguments = needsResponseHeaders
		? `${contentTarget},${needsResponseCookies ? "context.response.cookies" : "undefined"},context.response.headers`
		: needsResponseCookies
			? `${contentTarget},context.response.cookies`
			: contentTarget;
	const returnStatement = `return ${responseName}(${responseArguments});`;
	// Only the outermost emission returns; nested code runs inside a next callback.
	const terminate = (code: string, isNested: boolean): string =>
		isNested ? code : `${code}${returnStatement}`;
	const slotTarget = (key: keyof ValidatorRequest): string =>
		getSlotTarget(needsContext, key);

	// Emits the route handler tail once the chain is exhausted.
	const emitRoute = (isNested: boolean): string => {
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
	};

	const emit = (index: number, isNested: boolean): string => {
		if (index >= chain.length) {
			return emitRoute(isNested);
		}

		const chainLink = chain[index];

		if (chainLink?.type === "MIDDLEWARE") {
			const isTailAsync = awaitMap[index + 1];
			const nextName = `next_${index}`;
			const returnedName = `returned_${index}`;
			// A sync middleware still awaits when its tail is async.
			const block = `{const ${nextName}=${isTailAsync ? "async " : ""}()=>{${emit(index + 1, true)}};const ${returnedName}=${awaitMap[index] ? "await " : ""}${link("chain")}[${index}].handler(${linkArgument},${nextName});if(${returnedName}){${contentTarget}=${returnedName}}}`;

			return terminate(block, isNested);
		}

		if (chainLink?.type === "STORE") {
			const returnedName = `returned_${index}`;
			const call = `const ${returnedName}=${asyncMap[index] ? "await " : ""}${link("chain")}[${index}].handler(${linkArgument});`;
			// A nested short circuit returns void so the caller resumes.
			const shortCircuit = `${contentTarget}=${returnedName};${isNested ? "return;" : returnStatement}`;
			const storeTarget = needsContext
				? "context.store"
				: needsStoreState
					? "validatedStore"
					: "";
			const mergeStore = storeTarget
				? `if(${returnedName}){${link("merge")}(${storeTarget},${returnedName})}`
				: "";

			return `{${call}if(${returnedName} instanceof ${link("Reply")}&&!${returnedName}.success){${shortCircuit}}${mergeStore}}${emit(index + 1, isNested)}`;
		}

		if (
			chainLink?.type === "VALIDATOR" &&
			hasValidationState &&
			hasValidationKeys(chainLink.keys)
		) {
			const keys = collectValidationKeys(chainLink.keys);
			const errorTarget = `errors_${index}`;
			const requestTarget = `request_${index}`;

			let validations = "";

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]!;
				const target = slotTarget(key);
				const keyLiteral = JSON.stringify(key);

				// Parsing waits for this position so earlier links can short circuit.
				if (!parsedKeys.has(key)) {
					parsedKeys.add(key);
					validations += parsers[key]();
				}

				// Each slot gets its own block so "validated" can be redeclared.
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
 * Generates the statements that run before the chain of a dispatcher.
 */
const generatePrelude = (
	shape: EndpointShape,
	parsers: Record<keyof ValidatorRequest, () => string>,
	slotTarget: (key: keyof ValidatorRequest) => string,
	link: LinkFactoryDependency,
): string[] => {
	const statements: string[] = [];

	if (shape.needsContext) {
		statements.push(`const context=new ${link("Empty")}();`);

		if (shape.needsMemory) {
			statements.push(`context.memory=${link("app")}.memory;`);
		}

		if (shape.needsRequest) {
			statements.push(
				`context.request=new ${link("Empty")}();context.request.raw=request;`,
			);
		}

		if (shape.needsResponseMetadata) {
			statements.push(`context.response=new ${link("Empty")}();`);
		}

		if (shape.needsResponseCookies) {
			statements.push(
				`context.response.cookies=new ${link("CookieMap")}(request.headers.get("cookie")??undefined);`,
			);
		}

		if (shape.needsResponseHeaders) {
			statements.push(
				`context.response.headers=new ${link("Headers")}();`,
			);
		}

		if (shape.needsServer) {
			statements.push(`context.server=${link("app")}.server;`);
		}

		if (shape.needsStore) {
			statements.push(`context.store=new ${link("Empty")}();`);
		}

		if (!shape.needsResponseContent) {
			statements.push("let content;");
		}
	} else {
		statements.push("let content;");

		if (shape.isSse && shape.hasValidationState) {
			statements.push(`const server=${link("app")}.server;`);
		}

		if (shape.validationKeys.length > 0) {
			statements.push(
				`let ${shape.validationKeys.map(slotTarget).join(",")};`,
			);
		}

		if (shape.needsStoreState) {
			statements.push(`const validatedStore=new ${link("Empty")}();`);
		}
	}

	if (shape.needsContext && shape.parsesParams) {
		statements.push(parsers.params());
	}

	return statements;
};

/**
 * Builds the factory source and the dependency names it links, in link order.
 */
const createDispatcherFactoryPlan = (
	endpoint: Endpoint,
	shape: EndpointShape,
) => {
	const { dependencies, link } = createDependencyLinker();
	const slotTarget = (key: keyof ValidatorRequest) =>
		getSlotTarget(shape.needsContext, key);
	// Thunks keep each slot's dependency linked in emission order.
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

	const prelude = generatePrelude(shape, parsers, slotTarget, link);
	const body = generateDispatcherBody(endpoint.chain, parsers, shape, link);
	const parameters = shape.needsMatch ? "request,match" : "request";
	const source = `return ${shape.isChainAsync ? "async " : ""}function(${parameters}){${prelude.join("")}${body}}`;

	return { dependencies, source };
};

/**
 * Resolves a dependency name to the value injected into a factory.
 */
const resolveFactoryDependency = (
	name: FactoryDependencyName,
	app: Cudenix,
	endpoint: Endpoint,
	validator: ValidatorPlugin | undefined,
): FactoryDependencyValue => {
	switch (name) {
		case "app":
			return app;
		case "CookieMap":
			return Bun.CookieMap;
		case "Headers":
			return Headers;
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

/**
 * Stores compiled dispatcher factories by endpoint shape.
 */
const factories = new Map<string, DispatcherFactoryEntry>();

/**
 * Returns the exact dependency names linked by a generated dispatcher factory.
 *
 * @internal
 *
 * @example
 * ```typescript
 * const dependencies = inspectJitFactoryDependencies(app, endpoint);
 * ```
 */
export const inspectJitFactoryDependencies = (
	app: Cudenix,
	endpoint: Endpoint,
): readonly FactoryDependencyName[] => {
	const handler = endpoint.route.handler;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const handlerAnalysis = analyzeHandler(handler);

	if (isDirectDispatch(endpoint, handlerAnalysis, validator !== undefined)) {
		return ["response", "handler"];
	}

	const shape = analyzeEndpoint(endpoint, validator, handlerAnalysis);

	return createDispatcherFactoryPlan(endpoint, shape).dependencies;
};

/**
 * Compiles an endpoint into a request dispatcher.
 *
 * @example
 * ```typescript
 * const dispatch = jit(app, endpoint);
 *
 * await dispatch.call(endpoint, request); // Response
 * ```
 */
export const jit = (app: Cudenix, endpoint: Endpoint) => {
	const handler = endpoint.route.handler;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const handlerAnalysis = analyzeHandler(handler);

	if (isDirectDispatch(endpoint, handlerAnalysis, validator !== undefined)) {
		return handlerAnalysis.isAsync
			? directAsyncFactory(response, handler)
			: directSyncFactory(response, handler);
	}

	const shape = analyzeEndpoint(endpoint, validator, handlerAnalysis);

	let entry = factories.get(shape.key);

	if (entry === undefined) {
		const plan = createDispatcherFactoryPlan(endpoint, shape);

		entry = {
			dependencies: plan.dependencies,
			factory: new Function(
				...plan.dependencies,
				plan.source,
			) as DispatcherFactory,
		};

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
