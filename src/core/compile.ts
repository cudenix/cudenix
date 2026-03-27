import type { App, Chain, Endpoint } from "@/core/app";
import { type AnyModule, Module } from "@/core/module";
import { Empty } from "@/utils/objects/empty";
import { pathToRegexp } from "@/utils/regexp/path-to-regexp";
import { validateStandardSchema } from "@/utils/standard-schema/validate";

const GET_URL_PATHNAME_REGEXP =
	/^(?:[a-zA-Z][a-zA-Z\d+\-.]*:\/\/)?[^/?#]*(\/[^?#]*)?/;

export const USE_BODY = 1;
export const USE_COOKIES = 2;
export const USE_HEADERS = 4;
export const USE_PARAMS = 8;
export const USE_QUERY = 16;

const USE_ALL = USE_BODY | USE_COOKIES | USE_HEADERS | USE_PARAMS | USE_QUERY;

const USE_KEYWORDS = [
	[USE_BODY, "body"],
	[USE_COOKIES, "cookies"],
	[USE_HEADERS, "headers"],
	[USE_PARAMS, "params"],
	[USE_QUERY, "query"],
] as const satisfies Array<[number, string]>;

const KEY_TO_BIT = {
	body: USE_BODY,
	cookies: USE_COOKIES,
	headers: USE_HEADERS,
	params: USE_PARAMS,
	query: USE_QUERY,
} as const satisfies Record<string, number>;

export interface PreviousStep {
	chain: Chain;
	path: string;
}

export const compileStep = (
	endpoints: Map<string, Endpoint[]>,
	module: AnyModule,
	previous: PreviousStep,
) => {
	const chain = [] as Chain;

	let path = module.prefix;

	for (let i = 0; i < module.chain.length; i++) {
		const link = module.chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "GROUP") {
			const module = new Module({
				prefix: `${previous.path}${path === "/" ? "" : path}${link.prefix === "/" ? "" : link.prefix}`,
			});

			module.chain = previous.chain.concat(chain);

			compileStep(endpoints, link.group(module), {
				chain: [],
				path: "",
			});

			continue;
		}

		if (
			link.type === "MIDDLEWARE" ||
			link.type === "STORE" ||
			link.type === "VALIDATOR"
		) {
			chain.push(link);

			continue;
		}

		if (link.type === "MODULE") {
			const compiled = compileStep(endpoints, link, {
				chain: previous.chain.concat(chain),
				path: `${previous.path}${path === "/" ? "" : path}`,
			});

			chain.push(...compiled.chain);

			if (compiled.path !== "/") {
				path = `${path === "/" ? "" : path}${compiled.path}`;
			}

			continue;
		}

		const mergedChain = previous.chain.concat(chain);

		let useBits = 0;

		for (let j = 0; j < mergedChain.length; j++) {
			if (useBits === USE_ALL) {
				break;
			}

			const link = mergedChain[j];

			if (!link) {
				continue;
			}

			if (link.type === "VALIDATOR") {
				for (let k = 0; k < link.keys.length; k++) {
					const key = link.keys[k];

					if (!key) {
						continue;
					}

					useBits |= KEY_TO_BIT[key];
				}

				continue;
			}

			const text =
				link[link.type.toLowerCase() as keyof typeof link].toString();

			if (!text) {
				continue;
			}

			for (let k = 0; k < USE_KEYWORDS.length; k++) {
				const keyword = USE_KEYWORDS[k];

				if (
					!keyword ||
					(useBits & keyword[0]) !== 0 ||
					text.indexOf(keyword[1]) === -1
				) {
					continue;
				}

				useBits |= keyword[0];
			}
		}

		if (useBits !== USE_ALL) {
			const text = link.route.toString();

			for (let j = 0; j < USE_KEYWORDS.length; j++) {
				const keyword = USE_KEYWORDS[j];

				if (
					!keyword ||
					(useBits & keyword[0]) !== 0 ||
					text.indexOf(keyword[1]) === -1
				) {
					continue;
				}

				useBits |= keyword[0];
			}
		}

		if (link.validator && useBits !== USE_ALL) {
			for (let j = 0; j < link.validator.keys.length; j++) {
				const key = link.validator.keys[j];

				if (!key) {
					continue;
				}

				useBits |= KEY_TO_BIT[key];
			}
		}

		const method = link.method === "WS" ? "GET" : link.method;

		let methodEndpoints = endpoints.get(method);

		if (!methodEndpoints) {
			methodEndpoints = [];

			endpoints.set(method, methodEndpoints);
		}

		const finalPath =
			`${previous.path}${path === "/" ? "" : path}${link.path === "/" ? "" : link.path}` ||
			"/";

		methodEndpoints.push({
			chain: link.validator
				? mergedChain.concat(link.validator)
				: mergedChain,
			generator: link.generator,
			paramsRegexp: new RegExp(
				`^${pathToRegexp(finalPath, {
					captureParamGroups: true,
				})}$`,
			),
			path: finalPath,
			route: link,
			use: useBits,
		});
	}

	return {
		chain,
		path,
	};
};

export const compile = (app: App, module: AnyModule) => {
	if (!app.memory.has("validator")) {
		app.memory.set("validator", validateStandardSchema);
	}

	const endpoints = new Map<string, Endpoint[]>();

	compileStep(endpoints, module, {
		chain: [],
		path: "",
	});

	for (const [method, methodEndpoints] of endpoints) {
		if (methodEndpoints.length === 0) {
			continue;
		}

		app.routes ??= new Empty() as NonNullable<App["routes"]>;

		const methodRegexps = [] as string[];
		const routes = app.routes;

		for (let j = 0; j < methodEndpoints.length; j++) {
			const methodEndpoint = methodEndpoints[j];

			if (!methodEndpoint) {
				continue;
			}

			methodRegexps.push(pathToRegexp(methodEndpoint.path));

			if (
				methodEndpoint.path.indexOf("?") !== -1 ||
				methodEndpoint.path.indexOf("...") !== -1
			) {
				continue;
			}

			routes[methodEndpoint.path] ??= new Empty() as NonNullable<
				(typeof routes)[string]
			>;

			routes[methodEndpoint.path]![method] = (request: Request) => {
				return app.endpoint(
					methodEndpoint,
					GET_URL_PATHNAME_REGEXP.exec(request.url)?.[1] ||
						request.url,
					request,
				);
			};
		}

		app.methods.set(method, {
			endpoints: methodEndpoints,
			regexp: new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${methodRegexps.join("|")})(?![^?#])`,
			),
		});
	}
};
