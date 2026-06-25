import { Context } from "@/core/context";
import type { Cudenix, Endpoint, EndpointChain } from "@/core/cudenix";
import { type Dispatch, serialize } from "@/core/dispatch";
import { fail, Reply } from "@/core/reply";
import { stream } from "@/core/sse";
import type { ValidatorRequest } from "@/core/validator";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { isAsync } from "@/utils/functions/is-async";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";
import { parseParams } from "@/utils/urls/parse-params";
import { parseQuery } from "@/utils/urls/parse-query";

const PARSERS: Record<keyof ValidatorRequest, (raw: string) => string> = {
	body: (raw) => `context.request.body = await parseBody(${raw});`,
	cookies: (raw) =>
		`context.request.cookies = parseCookies(${raw}.headers.get("cookie") ?? "");`,
	headers: (raw) => `context.request.headers = ${raw}.headers.toJSON();`,
	params: (raw) =>
		`context.request.params = "cookies" in ${raw} ? ${raw}.params : parseParams(context.match, this.paramKeys, this.matchOffset, this.restKeys);`,
	query: (raw) => `context.request.query = parseQuery(${raw}.url);`,
};

const generate = (
	chain: EndpointChain,
	index: number,
	sse: boolean,
	parsed: Set<string>,
	nested: boolean,
	needsAwait: boolean[],
	linkAsync: boolean[],
	routeAsync: boolean,
): string => {
	if (index >= chain.length) {
		if (sse) {
			const body = `context.server.timeout(context.request.raw, 0);

				context.response.content = stream(this.route.handler(context));`;

			return nested ? body : `${body}\n\nreturn serialize(context);`;
		}

		const call = routeAsync
			? "context.response.content = await this.route.handler(context);"
			: "context.response.content = this.route.handler(context);";

		return nested ? call : `${call}\n\nreturn serialize(context);`;
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
			routeAsync,
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
				${generate(chain, index + 1, sse, parsed, true, needsAwait, linkAsync, routeAsync)}
			};

			${call}

			if (returned_${index}) {
				context.response.content = returned_${index};
			}
		}`;

		return nested ? block : `${block}\n\nreturn serialize(context);`;
	}

	if (link.type === "STORE") {
		const call = linkAsync[index]
			? `const returned_${index} = await chain[${index}].handler(context);`
			: `const returned_${index} = chain[${index}].handler(context);`;

		return `{
			${call}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				context.response.content = returned_${index};

				return${nested ? "" : " serialize(context)"};
			}

			merge(context.store, returned_${index});
		}

		${generate(chain, index + 1, sse, parsed, nested, needsAwait, linkAsync, routeAsync)}`;
	}

	if (link.type === "VALIDATOR") {
		let keys = "";
		let usedRaw = false;

		for (let i = 0; i < link.keys.length; i++) {
			const key = link.keys[i];

			if (!key) {
				continue;
			}

			let load = "";

			if (!parsed.has(key)) {
				parsed.add(key);

				load = PARSERS[key](`raw_${index}`);

				usedRaw = true;
			}

			const json = JSON.stringify(key);

			const validate = `{
					const validated = await validator_${index}(
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
			const validator_${index} = context.memory.validator;

			if (validator_${index}) {
				const request_${index} = chain[${index}].request;
				${usedRaw ? `const raw_${index} = context.request.raw;\n` : ""}
				let errors_${index};

				${keys}

				if (errors_${index}) {
					context.response.content = fail(errors_${index}, { status: 422 });

					return${nested ? "" : " serialize(context)"};
				}
			}
		}

		${generate(chain, index + 1, sse, parsed, nested, needsAwait, linkAsync, routeAsync)}`;
	}

	return generate(
		chain,
		index + 1,
		sse,
		parsed,
		nested,
		needsAwait,
		linkAsync,
		routeAsync,
	);
};

export const jit = (app: Cudenix, endpoint: Endpoint) => {
	const chain = endpoint.chain;
	const routeHandler = endpoint.route.handler;
	const sse = endpoint.route.sse;

	const length = chain.length;
	const linkAsync = new Array<boolean>(length);
	const needsAwait = new Array<boolean>(length + 1);
	const routeAsync = isAsync(routeHandler);

	let tail = !sse && routeAsync;

	needsAwait[length] = tail;

	for (let i = length - 1; i >= 0; i--) {
		const link = chain[i];

		if (link) {
			if (link.type === "VALIDATOR") {
				tail = true;
			} else if (link.type === "MIDDLEWARE" || link.type === "STORE") {
				const async = isAsync(link.handler);

				linkAsync[i] = async;
				tail = async || tail;
			}
		}

		needsAwait[i] = tail;
	}

	const async = tail ? "async " : "";

	const factory = new Function(
		"app",
		"Context",
		"chain",
		"serialize",
		"Reply",
		"merge",
		"Empty",
		"fail",
		"stream",
		"parseBody",
		"parseCookies",
		"parseParams",
		"parseQuery",
		`return ${async}function (request, match) {\nconst context = new Context(app, this, request, match);\n\n${generate(chain, 0, sse, new Set(), false, needsAwait, linkAsync, routeAsync)}\n};`,
	) as (
		app: Cudenix,
		context: typeof Context,
		chain: EndpointChain,
		serializeContext: typeof serialize,
		reply: typeof Reply,
		mergeObjects: typeof merge,
		empty: typeof Empty,
		failReply: typeof fail,
		sseStream: typeof stream,
		bodyParser: typeof parseBody,
		cookieParser: typeof parseCookies,
		paramsParser: typeof parseParams,
		queryParser: typeof parseQuery,
	) => Dispatch;

	return factory(
		app,
		Context,
		chain,
		serialize,
		Reply,
		merge,
		Empty,
		fail,
		stream,
		parseBody,
		parseCookies,
		parseParams,
		parseQuery,
	);
};
