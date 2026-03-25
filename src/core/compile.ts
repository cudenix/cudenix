import type { App, Chain, Endpoint } from "@/core/app";
import { type AnyModule, Module } from "@/core/module";
import { Empty } from "@/utils/objects/empty";
import { validateStandardSchema } from "@/utils/standard-schema/validate";

interface Previous {
	chain: Chain;
	path: string;
}

const GET_URL_PATHNAME_REGEXP =
	/^(?:[a-zA-Z][a-zA-Z\d+\-.]*:\/\/)?[^/?#]*(\/[^?#]*)?/;

const USE_BODY = 1;
const USE_COOKIES = 2;
const USE_HEADERS = 4;
const USE_PARAMS = 8;
const USE_QUERY = 16;
const USE_ALL = USE_BODY | USE_COOKIES | USE_HEADERS | USE_PARAMS | USE_QUERY;

const USE_REGEXPS = [
	[USE_BODY, /\bbody\b/m],
	[USE_COOKIES, /\bcookies\b/m],
	[USE_HEADERS, /\bheaders\b/m],
	[USE_PARAMS, /\bparams\b/m],
	[USE_QUERY, /\bquery\b/m],
] as const satisfies Array<[number, RegExp]>;

const KEY_TO_BIT = {
	body: USE_BODY,
	cookies: USE_COOKIES,
	headers: USE_HEADERS,
	params: USE_PARAMS,
	query: USE_QUERY,
} as const satisfies Record<string, number>;

const pathToRegexp = (path: string, captureParamGroups = false) => {
	if (path === "/") {
		return "()\\/";
	}

	let pattern = "()";

	const segments = path.split("/");

	for (let i = 0; i < segments.length; i++) {
		let segment = segments[i];

		if (!segment) {
			continue;
		}

		const isOptional = segment.endsWith("?");

		if (isOptional) {
			segment = segment.slice(0, -1);
		}

		if (segment.startsWith(":")) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(1)}>` : ""}[^/\\s?#]+${captureParamGroups ? ")" : ""}`;
		} else if (segment.startsWith("...")) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(3)}>` : ""}(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)${captureParamGroups ? ")" : ""}`;
		} else {
			segment = `\\/${RegExp.escape(segment)}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern += segment;
	}

	return pattern;
};

const step = (
	endpoints: App["endpoints"],
	module: AnyModule,
	previous: Previous,
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

			step(endpoints, link.group(module), {
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
			const compiled = step(endpoints, link, {
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

			for (let k = 0; k < USE_REGEXPS.length; k++) {
				const regexp = USE_REGEXPS[k];

				if (
					!regexp ||
					(useBits & regexp[0]) !== 0 ||
					!regexp[1].test(text)
				) {
					continue;
				}

				useBits |= regexp[0];
			}
		}

		if (useBits !== USE_ALL) {
			const text = link.route.toString();

			for (let j = 0; j < USE_REGEXPS.length; j++) {
				const regexp = USE_REGEXPS[j];

				if (
					!regexp ||
					(useBits & regexp[0]) !== 0 ||
					!regexp[1].test(text)
				) {
					continue;
				}

				useBits |= regexp[0];
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

		const use = new Set<string>() as Endpoint["use"];

		if (useBits & USE_BODY) {
			use.add("body");
		}

		if (useBits & USE_COOKIES) {
			use.add("cookies");
		}

		if (useBits & USE_HEADERS) {
			use.add("headers");
		}

		if (useBits & USE_PARAMS) {
			use.add("params");
		}

		if (useBits & USE_QUERY) {
			use.add("query");
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
			paramsRegexp: new RegExp(`^${pathToRegexp(finalPath, true)}$`),
			path: finalPath,
			route: link,
			use,
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

	step(app.endpoints, module, {
		chain: [],
		path: "",
	});

	for (const [method, endpoints] of app.endpoints) {
		if (endpoints.length === 0) {
			continue;
		}

		app.routes ??= new Empty() as NonNullable<App["routes"]>;

		const methodRegexps = [] as string[];
		const routes = app.routes;

		for (let j = 0; j < endpoints.length; j++) {
			const methodEndpoint = endpoints[j];

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

			routes[methodEndpoint.path]![
				method as keyof (typeof routes)[string]
			] = async (request: Request) => {
				return app.endpoint(
					methodEndpoint,
					GET_URL_PATHNAME_REGEXP.exec(request.url)?.[1] ||
						request.url,
					request,
				);
			};
		}

		app.regexps.set(
			method,
			new RegExp(
				`^(https?:\\/\\/)[^\\s\\/]+(${methodRegexps.join("|")})(?![^?#])`,
			),
		);
	}
};
