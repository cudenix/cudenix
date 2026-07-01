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
} satisfies Record<Exclude<keyof ValidatorRequest, "params">, string>;

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
 *
 * The outer call fixes the chain-wide invariants and derives the shape strings
 * once; the inner `emit(index, isNested)` walks the links front-to-back.
 * `isNested` marks code emitted inside a middleware `next()` closure, where
 * the dispatcher-level return is suppressed.
 */
const generateDispatcherBody = (
	chain: EndpointChain,
	isSse: boolean,
	awaitMap: boolean[],
	asyncMap: boolean[],
	isRouteAsync: boolean,
	parsers: Record<keyof ValidatorRequest, string>,
	hasValidator: boolean,
	isValidatorAsync: boolean,
	needsContext: boolean,
): string => {
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
				const body = `${needsContext ? "context" : "app"}.server.timeout(request, 0);

				${contentTarget} = stream(handler(${routeArgument}));`;

				return terminate(body, isNested);
			}

			const callCode = `${contentTarget} = ${isRouteAsync ? "await " : ""}handler(${routeArgument});`;

			return terminate(callCode, isNested);
		}

		const link = chain[index];

		if (link?.type === "MIDDLEWARE") {
			const isTailAsync = awaitMap[index + 1];

			const callCode = `const returned_${index} = ${asyncMap[index] || isTailAsync ? "await " : ""}chain[${index}].handler(${linkArgument}, next_${index});`;

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
				context.response.content = fail(errors_${index}, { status: 422 });

				return${isNested ? "" : ` ${RESPONSE_CALL}`};
			}
		}

		${emit(index + 1, isNested)}`;
		}

		return emit(index + 1, isNested);
	};

	return emit(0, false);
};

/**
 * Walk the chain back-to-front to resolve the async/context shape the
 * dispatcher is generated against.
 *
 * Two per-link arrays come out of the pass:
 *
 * - `asyncMap[i]` — whether link `i`'s own handler is declared `async` (only
 *   middleware and store links call a handler directly).
 * - `awaitMap[i]` — whether anything from link `i` onward awaits, so the
 *   generator knows when a `next()` closure must itself be `async`. The extra
 *   `awaitMap[chainLength]` slot seeds the tail (the route handler).
 *
 * Alongside them two whole-chain flags fold up:
 *
 * - `isChainAsync` — whether the dispatcher needs the `async` keyword at all.
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
	isChainAsync: boolean;
	asyncMap: boolean[];
	awaitMap: boolean[];
	needsContext: boolean;
} => {
	const chainLength = chain.length;

	const asyncMap = new Array<boolean>(chainLength);
	const awaitMap = new Array<boolean>(chainLength + 1);

	let isChainAsync = !isSse && isRouteAsync;
	let needsContext = usesContext(handler);

	awaitMap[chainLength] = isChainAsync;

	for (let i = chainLength - 1; i >= 0; i--) {
		const link = chain[i];

		if (link) {
			if (link.type === "VALIDATOR") {
				if (hasValidator) {
					if (isValidatorAsync || link.keys.includes("body")) {
						isChainAsync = true;
					}

					needsContext = true;
				}
			} else if (link.type === "MIDDLEWARE" || link.type === "STORE") {
				const isHandlerAsync = isAsync(link.handler);

				asyncMap[i] = isHandlerAsync;

				isChainAsync = isHandlerAsync || isChainAsync;

				if (!needsContext && usesContext(link.handler)) {
					needsContext = true;
				}
			}
		}

		awaitMap[i] = isChainAsync;
	}

	return { asyncMap, awaitMap, isChainAsync, needsContext };
};

/**
 * Shape of the factory `new Function` compiles. Its parameter names are the
 * free identifiers of the generated dispatcher, and each parameter matches —
 * position for position — the argument `jit` passes when invoking it (the
 * `import()` type queries stand in for `typeof X` on the same-named
 * parameters, which TypeScript rejects as self-references).
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
 * One compiled factory per distinct generated source. Two endpoints whose
 * chains emit byte-identical dispatchers — the common case, since routes
 * sharing a module's chain shape differ only in the values passed to the
 * factory — reuse a single `new Function` compilation; every call still
 * returns a fresh dispatcher bound to its own endpoint. Intentionally
 * unbounded: growth is capped by the number of distinct endpoint shapes, and
 * factories close over nothing.
 */
const factories = new Map<string, DispatcherFactory>();

export const jit = (app: Cudenix, endpoint: Endpoint) => {
	const chain = endpoint.chain;
	const handler = endpoint.route.handler;
	const isRouteAsync = isAsync(handler);
	const isSse = endpoint.route.sse;
	const validator = app.memory.validator as ValidatorPlugin | undefined;
	const hasValidator = validator !== undefined;
	const isValidatorAsync = hasValidator && isAsync(validator);

	const { isChainAsync, asyncMap, awaitMap, needsContext } = analyzeChain(
		chain,
		handler,
		isSse,
		isRouteAsync,
		hasValidator,
		isValidatorAsync,
	);

	const parsers: Record<keyof ValidatorRequest, string> = {
		...PARSERS,
		params: generateParamsParser(
			endpoint.paramKeys,
			endpoint.matchOffset,
			endpoint.restKeys,
		),
	};

	const prelude = needsContext
		? `\nconst context = new Context(app, request, match);\nconst isBun = "cookies" in request;\n\n`
		: "\nlet content;\n\n";

	const body = generateDispatcherBody(
		chain,
		isSse,
		awaitMap,
		asyncMap,
		isRouteAsync,
		parsers,
		hasValidator,
		isValidatorAsync,
		needsContext,
	);

	const source = `return ${isChainAsync ? "async " : ""}function (request, match) {${prelude}${body}\n};`;

	let factory = factories.get(source);

	if (factory === undefined) {
		factory = new Function(
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
			source,
		) as DispatcherFactory;

		factories.set(source, factory);
	}

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
