import { analyzeHandler, type HandlerAnalysis } from "@/core/analyzer";
import type { Cudenix, Endpoint, EndpointChain } from "@/core/cudenix";
import { fail, Reply } from "@/core/reply";
import { response } from "@/core/response";
import { stream } from "@/core/sse";
import type {
	AnyValidator,
	CompiledValidator,
	ValidatorCompiler,
	ValidatorPlugin,
	ValidatorRequest,
} from "@/core/validator";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { isAsync } from "@/utils/functions/is-async";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";
import { peek, peekStatus } from "@/utils/promises/peek";
import {
	PARAM_FLAG_OPTIONAL,
	PARAM_FLAG_REST,
} from "@/utils/regexps/path-to-regexp";
import { decodePathParam } from "@/utils/urls/decode-path-param";
import { parseQuery } from "@/utils/urls/parse-query";

/**
 * Reads every enumerable property of a store result without keeping it.
 */
const drain = (source: Record<string, unknown>) => {
	let value: unknown;

	for (const key in source) {
		value = source[key];
	}

	return value;
};

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
 * Maps each validated request slot of a link to its compiled validator, or to
 * `null` when the slot falls back to the runtime validator.
 */
type CompiledValidatorSlots = Record<string, CompiledValidator | null>;

/**
 * Maps each chain position to the compiled validation functions it calls.
 */
type CompiledValidatorRuns = Record<string, CompiledValidator["run"]>[];

/**
 * Maps each dependency name to the value a dispatcher factory receives.
 */
interface FactoryDependencyValues {
	app: Cudenix;
	CookieMap: typeof Bun.CookieMap;
	chain: EndpointChain;
	compiled: CompiledValidatorRuns;
	decodePathParam: typeof decodePathParam;
	drain: typeof drain;
	Empty: typeof Empty;
	fail: typeof fail;
	Headers: typeof Headers;
	handler: Endpoint["route"]["handler"];
	merge: typeof merge;
	parseBody: typeof parseBody;
	parseCookies: typeof parseCookies;
	parseQuery: typeof parseQuery;
	peek: typeof peek;
	peekStatus: typeof peekStatus;
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
 * Describes the prebuilt factory for a sync route that needs no generated
 * dispatcher.
 */
type DirectSyncFactory = (
	responseFn: typeof response,
	handler: Endpoint["route"]["handler"],
) => Endpoint["dispatch"];

/**
 * Describes the prebuilt factory for an async route that needs no generated
 * dispatcher.
 */
type DirectAsyncFactory = (
	responseFn: typeof response,
	handler: Endpoint["route"]["handler"],
	peekFn: typeof peek,
	peekStatusFn: typeof peekStatus,
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
	compiledSlots: (CompiledValidatorSlots | undefined)[] | undefined;
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
 * Returns whether a parameter is optional.
 */
const isOptionalParam = (flags: number | undefined) =>
	flags === undefined || (flags & PARAM_FLAG_OPTIONAL) !== 0;

/**
 * Returns whether a parameter is a rest segment.
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
) as DirectSyncFactory;

/**
 * Builds the dispatcher for an async route with no context and no chain.
 */
const directAsyncFactory = new Function(
	"response",
	"handler",
	"peek",
	"peekStatus",
	'return async function(){const returned=handler();return response(peekStatus(returned)==="fulfilled"?peek(returned):await returned)}',
) as DirectAsyncFactory;

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
		const flags = paramKey === undefined ? 0 : paramFlags?.[i];

		optionalBits += bit(isOptionalParam(flags));
		restBits += bit(isRestParam(flags, paramKey, restKeys));
	}

	return `P${endpoint.matchOffset}${JSON.stringify(paramKeys)}O${optionalBits}R${restBits}`;
};

/**
 * Stores compiled validators by compiler and validator link.
 */
const compiledValidators = new WeakMap<
	ValidatorCompiler,
	WeakMap<AnyValidator, CompiledValidatorSlots>
>();

/**
 * Compiles the request slots of a validator link once per compiler.
 */
const compileValidatorSlots = (
	compiler: ValidatorCompiler,
	link: AnyValidator,
	keys: readonly (keyof ValidatorRequest)[],
) => {
	let links = compiledValidators.get(compiler);

	if (links === undefined) {
		links = new WeakMap();

		compiledValidators.set(compiler, links);
	}

	let slots = links.get(link);

	if (slots === undefined) {
		slots = new Empty() as CompiledValidatorSlots;

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i]!;

			slots[key] = compiler(link.request[key], key) ?? null;
		}

		links.set(link, slots);
	}

	return slots;
};

/**
 * Analyzes an endpoint for dispatcher generation.
 */
const analyzeEndpoint = (
	endpoint: Endpoint,
	validator: ValidatorPlugin | undefined,
	compiler: ValidatorCompiler | undefined,
	handlerAnalysis: HandlerAnalysis,
): EndpointShape => {
	const chain = endpoint.chain;
	const chainLength = chain.length;
	const isSse = endpoint.route.sse;
	// an SSE handler is never awaited
	const isRouteAsync = !isSse && handlerAnalysis.isAsync;
	const hasValidator = validator !== undefined;
	const isValidatorAsync = hasValidator && isAsync(validator);
	const validatorTag = isValidatorAsync ? "Va" : "Vs";

	const asyncMap = new Array<boolean>(chainLength).fill(false);
	// the extra slot is the route handler tail
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
	let compiledSlots: (CompiledValidatorSlots | undefined)[] | undefined;
	let hasStore = false;
	let hasValidationState = false;
	let validatesParams = false;
	let emitsBelow = false;

	awaitMap[chainLength] = isChainAsync;

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

			// cache-key tag for the link
			tags[i] =
				link.type === "MIDDLEWARE"
					? `M${bit(isChainAsync)}${bit(awaitMap[i + 1])}${bit(isHandlerAsync)}`
					: `S${bit(isHandlerAsync)}`;

			emitsBelow = true;
		} else if (
			link?.type === "VALIDATOR" &&
			hasValidator &&
			hasValidationKeys(link.keys)
		) {
			const keys = collectValidationKeys(link.keys);
			const slots =
				compiler === undefined
					? undefined
					: compileValidatorSlots(compiler, link, keys);

			let hasFallbackSlot = false;
			// one character per slot: compiled sync, compiled async, fallback
			let slotBits = "";

			for (let j = 0; j < keys.length; j++) {
				const key = keys[j]!;
				const compiled = slots?.[key];

				validationKeySet.add(key);

				if (key === "body") {
					isChainAsync = true;
				} else if (key === "params") {
					validatesParams = true;
				}

				if (!compiled) {
					hasFallbackSlot = true;
					slotBits += "f";
				} else if (compiled.sync) {
					slotBits += "c";
				} else {
					isChainAsync = true;
					slotBits += "C";
				}
			}

			hasValidationState = true;

			// only fallback slots inherit the runtime validator's asynchrony
			if (isValidatorAsync && hasFallbackSlot) {
				isChainAsync = true;
			}

			if (slots !== undefined) {
				compiledSlots ??= new Array(chainLength);
				compiledSlots[i] = slots;
			}

			tags[i] = `${validatorTag}${JSON.stringify(keys)}${slotBits}`;

			emitsBelow = true;
		} else if (emitsBelow) {
			// placeholder for a link that emits nothing
			tags[i] = "_";
		}

		awaitMap[i] = isChainAsync;
	}

	const needsResponseMetadata =
		needsResponseContent || needsResponseCookies || needsResponseHeaders;

	if (needsContext) {
		needsRequest ||= hasValidationState;
		needsRequest ||= endpoint.paramKeys.length > 0;
		needsServer ||= isSse;
		// store links need the store object
		needsStore ||= hasStore;
	}

	const parsesParams =
		validatesParams || (needsContext && endpoint.paramKeys.length > 0);
	const needsMatch = parsesParams && endpoint.paramKeys.length > 0;
	const needsStoreState = hasValidationState && hasStore && !needsContext;

	// key layout: context flag, shape bits, chain tags, "G", parameter layout
	const key = `${needsContext ? "C" : "N"}${bit(needsMemory)}${bit(needsRequest)}${bit(needsResponseContent)}${bit(needsResponseCookies)}${bit(needsResponseHeaders)}${bit(needsServer)}${bit(needsStore)}${bit(hasValidationState)}${bit(isSse)}${bit(isRouteAsync)}${tags.join("")}G${needsMatch ? buildParamLayoutKey(endpoint) : ""}`;

	return {
		asyncMap,
		awaitMap,
		compiledSlots,
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
 * Emits the gate that reads a settled native promise instead of awaiting it.
 */
const gate = (name: string, link: LinkFactoryDependency) =>
	`${link("peekStatus")}(${name})==="fulfilled"?${link("peek")}(${name}):await ${name}`;

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

		const matchGroupIndex = matchOffset + i;
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
			? `${valueExpression}.split("/").map(${decodePathParamName})`
			: decodedValue;

		assignmentsCode += isOptional
			? `const ${valueName}=match[${matchGroupIndex}];if(${valueName}!==undefined){params[${keyLiteral}]=${paramValueExpression}}`
			: `params[${keyLiteral}]=${paramValueExpression};`;
	}

	// fall back to the regexp match when Bun parsed no params
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
		compiledSlots,
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
		// the prelude already parsed params
		parsedKeys.add("params");
	}

	// without context a link takes an explicit undefined and the route nothing
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
	// only the outermost emission returns
	const terminate = (code: string, isNested: boolean): string =>
		isNested ? code : `${code}${returnStatement}`;
	const slotTarget = (key: keyof ValidatorRequest): string =>
		getSlotTarget(needsContext, key);

	// emits the route handler tail
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

		if (!isRouteAsync) {
			return terminate(
				`${contentTarget}=${handlerName}(${routeArgument});`,
				isNested,
			);
		}

		// an async handler that never suspends settles before it is read
		return terminate(
			`const handled=${handlerName}(${routeArgument});${contentTarget}=${gate("handled", link)};`,
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
			// only an async link is known to return a native promise
			const call = asyncMap[index]
				? `let ${returnedName}=${link("chain")}[${index}].handler(${linkArgument},${nextName});${returnedName}=${gate(returnedName, link)};`
				: `const ${returnedName}=${awaitMap[index] ? "await " : ""}${link("chain")}[${index}].handler(${linkArgument},${nextName});`;
			// the next callback is async when the tail awaits
			const block = `{const ${nextName}=${isTailAsync ? "async " : ""}()=>{${emit(index + 1, true)}};${call}if(${returnedName}){${contentTarget}=${returnedName}}}`;

			return terminate(block, isNested);
		}

		if (chainLink?.type === "STORE") {
			const returnedName = `returned_${index}`;
			// only an async link is known to return a native promise
			const call = asyncMap[index]
				? `let ${returnedName}=${link("chain")}[${index}].handler(${linkArgument});${returnedName}=${gate(returnedName, link)};`
				: `const ${returnedName}=${link("chain")}[${index}].handler(${linkArgument});`;
			// a nested short circuit returns void
			const shortCircuit = `${contentTarget}=${returnedName};${isNested ? "return;" : returnStatement}`;
			const storeTarget = needsContext ? "context.store" : "";
			// without a store object the result is only read for its side effects
			const mergeStore = storeTarget
				? `if(${returnedName}){${link("merge")}(${storeTarget},${returnedName})}`
				: needsStoreState
					? `if(${returnedName}){${link("drain")}(${returnedName})}`
					: "";

			return `{${call}if(${returnedName} instanceof ${link("Reply")}&&!${returnedName}.success){${shortCircuit}}${mergeStore}}${emit(index + 1, isNested)}`;
		}

		if (
			chainLink?.type === "VALIDATOR" &&
			hasValidationState &&
			hasValidationKeys(chainLink.keys)
		) {
			const keys = collectValidationKeys(chainLink.keys);
			const slots = compiledSlots?.[index];
			const errorTarget = `errors_${index}`;
			const requestTarget = `request_${index}`;

			let hasFallbackSlot = false;
			let validations = "";

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]!;
				const target = slotTarget(key);
				const compiled = slots?.[key];

				// parse each slot the first time it is validated
				if (!parsedKeys.has(key)) {
					parsedKeys.add(key);
					validations += parsers[key]();
				}

				let call: string;
				let prelude = "";

				if (compiled) {
					call = `${compiled.sync ? "" : "await "}${link("compiled")}[${index}].${key}(${target})`;
				} else {
					hasFallbackSlot = true;

					const validatorCall = `${link("validator")}(${requestTarget}.${key},${target},${JSON.stringify(key)})`;

					// an async validator that never suspends settles before it is read
					if (isValidatorAsync) {
						const slotName = `validated_${index}_${key}`;

						prelude = `const ${slotName}=${validatorCall};`;
						call = gate(slotName, link);
					} else {
						call = validatorCall;
					}
				}

				// each slot gets its own block
				validations += `{${prelude}const validated=${call};if(validated.success){${target}=validated.content}else{(${errorTarget}??=new ${link("Empty")}()).${key}=validated.content}}`;
			}

			const failure = `${contentTarget}=${link("fail")}(${errorTarget},{status:422});${isNested ? "return;" : returnStatement}`;
			// only fallback slots read the link's schemas
			const request = hasFallbackSlot
				? `const ${requestTarget}=${link("chain")}[${index}].request;`
				: "";

			return `{${request}let ${errorTarget};${validations}if(${errorTarget}){${failure}}}${emit(index + 1, isNested)}`;
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
	// thunks link each slot's dependency when emitted
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
 * Builds the compiled validation functions a dispatcher calls, by chain position.
 */
const buildCompiledRuns = (
	compiledSlots: (CompiledValidatorSlots | undefined)[] | undefined,
): CompiledValidatorRuns => {
	if (compiledSlots === undefined) {
		return [];
	}

	const runs: CompiledValidatorRuns = new Array(compiledSlots.length);

	for (let i = 0; i < compiledSlots.length; i++) {
		const slots = compiledSlots[i];

		if (slots === undefined) {
			continue;
		}

		const linkRuns = new Empty() as CompiledValidatorRuns[number];

		for (const key in slots) {
			const compiled = slots[key];

			// a null slot falls back to the runtime validator
			if (compiled) {
				linkRuns[key] = compiled.run;
			}
		}

		runs[i] = linkRuns;
	}

	return runs;
};

/**
 * Resolves a dependency name to the value injected into a factory.
 */
const resolveFactoryDependency = (
	name: FactoryDependencyName,
	app: Cudenix,
	endpoint: Endpoint,
	shape: EndpointShape,
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
		case "compiled":
			return buildCompiledRuns(shape.compiledSlots);
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
		case "drain":
			return drain;
		case "peek":
			return peek;
		case "peekStatus":
			return peekStatus;
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
	const compiler = app.memory.validatorCompiler as
		| ValidatorCompiler
		| undefined;
	const handlerAnalysis = analyzeHandler(handler);

	if (isDirectDispatch(endpoint, handlerAnalysis, validator !== undefined)) {
		return handlerAnalysis.isAsync
			? ["response", "handler", "peek", "peekStatus"]
			: ["response", "handler"];
	}

	const shape = analyzeEndpoint(
		endpoint,
		validator,
		compiler,
		handlerAnalysis,
	);

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
	const compiler = app.memory.validatorCompiler as
		| ValidatorCompiler
		| undefined;
	const handlerAnalysis = analyzeHandler(handler);

	if (isDirectDispatch(endpoint, handlerAnalysis, validator !== undefined)) {
		return handlerAnalysis.isAsync
			? directAsyncFactory(response, handler, peek, peekStatus)
			: directSyncFactory(response, handler);
	}

	const shape = analyzeEndpoint(
		endpoint,
		validator,
		compiler,
		handlerAnalysis,
	);

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
			shape,
			validator,
		);
	}

	return entry.factory(...values);
};
