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

/**
 * Full-context return expression; cookies are skipped on Bun, whose native
 * router applies them.
 */
const RESPONSE_CALL =
	"response(context.response.content, isBun ? undefined : context.response.cookies, context.response.headers)";

/**
 * Parse statement per request slot a validator can declare — except `params`,
 * whose parser is endpoint-specific ({@link generateParamsParser}).
 */
const PARSERS = {
	body: "context.request.body = await parseBody(request);",
	cookies: `context.request.cookies = parseCookies(request.headers.get("cookie") ?? "");`,
	headers: "context.request.headers = request.headers.toJSON();",
	query: "context.request.query = parseQuery(request.url);",
} satisfies Record<Exclude<keyof ValidatorRequest, "params">, string>;

/**
 * Emit the `context.request.params` parse statement: Bun's router hands the
 * params prebuilt; the regexp fallback decodes them from `match`, whose groups
 * start at `matchOffset + 1`. Keys in `restKeys` split into path parts.
 */
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
 * Shape {@link analyzeEndpoint} resolves for one endpoint: the async/context
 * flags, the per-link `asyncMap`/`awaitMap` (whose extra tail slot seeds the
 * route handler), and the {@link factories} cache `key`.
 */
interface EndpointShape {
	asyncMap: boolean[];
	awaitMap: boolean[];
	hasValidator: boolean;
	isChainAsync: boolean;
	isRouteAsync: boolean;
	isSse: boolean;
	isValidatorAsync: boolean;
	key: string;
	needsContext: boolean;
	validatesParams: boolean;
}

/**
 * Walk the chain back-to-front and distill the dispatcher's shape, plus `key`
 * — a compact encoding of exactly the inputs that determine the generated
 * source, so endpoints share a factory iff their dispatchers would be
 * byte-identical: three flag bits (`needsContext`, `isSse`, `isRouteAsync`),
 * one tag per chain position (`M` + two await bits, `S` + one async bit, `V` +
 * `a`/`s` + the JSON of its truthy keys, `_` for a position that emits nothing
 * — indices are embedded in identifiers, so interior `_` shift what follows
 * while trailing ones are dropped), and `P` + `matchOffset` + the JSON of
 * `paramKeys` + one rest bit per key when params are validated. JSON because
 * keys are user strings (`"a,b"` must not collide with `"a","b"`); the
 * handler, validator plugin, and chain stay out of the key — they are factory
 * arguments, never embedded in the source.
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
	let validatesParams = false;
	let emitsBelow = false;

	awaitMap[chainLength] = isChainAsync;

	for (let i = chainLength - 1; i >= 0; i--) {
		const link = chain[i];

		if (link?.type === "MIDDLEWARE" || link?.type === "STORE") {
			const isHandlerAsync = isAsync(link.handler);

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

			needsContext = true;

			tags[i] = `${validatorTag}${JSON.stringify(keys)}`;

			emitsBelow = true;
		} else if (emitsBelow) {
			tags[i] = "_";
		}

		awaitMap[i] = isChainAsync;
	}

	let key = `${needsContext ? "1" : "0"}${isSse ? "1" : "0"}${
		isRouteAsync ? "1" : "0"
	}${tags.join("")}`;

	if (validatesParams && endpoint.paramKeys.length > 0) {
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
		hasValidator,
		isChainAsync,
		isRouteAsync,
		isSse,
		isValidatorAsync,
		key,
		needsContext,
		validatesParams,
	};
};

/**
 * Emit the dispatcher body: `emit(index, isNested)` walks the links
 * front-to-back, with `isNested` marking code inside a middleware `next()`
 * closure, where the dispatcher-level return is suppressed. Under
 * `shape.needsContext` results flow through `context.response.content` into
 * the full {@link RESPONSE_CALL}; without it no `Context` is ever allocated —
 * links receive `undefined` and results flow through a local `content`.
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
		isRouteAsync,
		isSse,
		isValidatorAsync,
		needsContext,
	} = shape;

	const parsedKeys = new Set<keyof ValidatorRequest>();

	const linkArgument = needsContext ? "context" : "undefined";
	const routeArgument = needsContext ? "context" : "";
	const contentTarget = needsContext ? "context.response.content" : "content";
	const returnStatement = needsContext
		? `return ${RESPONSE_CALL};`
		: "return response(content);";

	const terminate = (code: string, isNested: boolean): string =>
		isNested ? code : `${code}\n\n${returnStatement}`;

	const emit = (index: number, isNested: boolean): string => {
		if (index >= chain.length) {
			if (isSse) {
				const body = `${needsContext ? "context" : "app"}.server?.timeout(request, 0);

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
 * Shape of the factory `new Function` compiles: its parameters are the free
 * identifiers of the generated dispatcher, matching {@link FACTORY_PARAMETERS}
 * position for position (the `import()` type queries avoid self-referencing
 * `typeof` on same-named parameters).
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
	validator: ValidatorPlugin | undefined,
	handler: Endpoint["route"]["handler"],
) => Dispatch;

/**
 * Parameter names of {@link DispatcherFactory}, kept as one list so the
 * compiled names cannot drift from the type.
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
	"validator",
	"handler",
] as const;

/**
 * One compiled factory per distinct dispatcher shape, keyed by
 * {@link EndpointShape}'s `key`; every call still returns a fresh dispatcher.
 * Intentionally unbounded — growth is capped by the number of distinct shapes.
 */
const factories = new Map<string, DispatcherFactory>();

/**
 * Compile (or reuse) the specialized {@link Dispatch} for one endpoint — on a
 * {@link factories} hit the source is never regenerated; only a new shape pays
 * for source generation and `new Function`.
 */
export const jit = (app: Cudenix, endpoint: Endpoint): Dispatch => {
	const shape = analyzeEndpoint(app, endpoint);

	let factory = factories.get(shape.key);

	if (factory === undefined) {
		const parsers: Record<keyof ValidatorRequest, string> = {
			...PARSERS,
			params: shape.validatesParams
				? generateParamsParser(
						endpoint.paramKeys,
						endpoint.matchOffset,
						endpoint.restKeys,
					)
				: "",
		};

		const prelude = shape.needsContext
			? `\nconst context = new Context(app, request, match);\nconst isBun = "cookies" in request;\n\n`
			: "\nlet content;\n\n";

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
		app.memory.validator as ValidatorPlugin | undefined,
		endpoint.route.handler,
	);
};
