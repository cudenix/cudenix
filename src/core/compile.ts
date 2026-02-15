import type { App, Chain, Endpoint } from "@/core/app";
import { type AnyModule, Module } from "@/core/module";
import { validateStandardSchema } from "@/utils/standard-schema/validate";

interface Stack {
	module: AnyModule;
	previous: {
		chain: Chain;
		path: string;
	};
}

const endsWithQuestionMarkRegexp = /\?$/;
const getUrlPathnameRegexp =
	/^(?:[a-zA-Z][a-zA-Z\d+\-.]*:\/\/)?[^/?#]*(\/[^?#]*)?/;
const startsWithColonRegexp = /^:/;
const startsWithEllipsisRegexp = /^\.{3}/;

const useRegexps = [
	["body", /\bbody\b/m],
	["cookies", /\bcookies\b/m],
	["headers", /\bheaders\b/m],
	["params", /\bparams\b/m],
	["query", /\bquery\b/m],
] as const;

const getLinkText = (link: Chain[number]): string => {
	switch (link.type) {
		case "MIDDLEWARE":
			return link.middleware.toString();
		case "ROUTE":
			return link.route.toString();
		case "STORE":
			return link.store.toString();
		default:
			return "";
	}
};

const pathToRegexp = (path: string, captureParamGroups = false) => {
	let pattern = "()";

	if (path === "/") {
		return `${pattern}\\/`;
	}

	const segments = path.split("/");

	for (let i = 0; i < segments.length; i++) {
		let segment = segments[i];

		if (!segment) {
			continue;
		}

		const isOptional = endsWithQuestionMarkRegexp.test(segment);

		if (isOptional) {
			segment = segment.slice(0, -1);
		}

		if (startsWithColonRegexp.test(segment)) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(1)}>` : ""}[^/\\s?#]+${captureParamGroups ? ")" : ""}`;
		} else if (startsWithEllipsisRegexp.test(segment)) {
			segment = `\\/${captureParamGroups ? `(?<${segment.slice(3)}>` : ""}(?:[^/\\s?#]+/)*(?:[^/\\s?#]+)${captureParamGroups ? ")" : ""}`;
		} else {
			segment = `/${segment}`;
		}

		if (isOptional) {
			segment = `(?:${segment})?`;
		}

		pattern = `${pattern}${segment}`;
	}

	return pattern;
};

const step = (
	stack: Stack[],
	endpoints: App["endpoints"],
	module: AnyModule,
	previous: Stack["previous"],
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

			module.chain = [...previous.chain, ...chain];

			stack.push({
				module: link.group(module),
				previous: {
					chain: [],
					path: "",
				},
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
			const compiled = step(stack, endpoints, link, {
				chain: [...previous.chain, ...chain],
				path: `${previous.path}${path === "/" ? "" : path}`,
			});

			chain.push(...compiled.chain);

			if (compiled.path !== "/") {
				path = `${path}${compiled.path}`;
			}

			continue;
		}

		const mergedChain = [...previous.chain, ...chain];

		const use = new Set<string>() as Endpoint["use"];

		for (let j = 0; j < mergedChain.length; j++) {
			if (use.size === 5) {
				break;
			}

			const link = mergedChain[j];

			if (!link) {
				continue;
			}

			const text = getLinkText(link);

			if (!text) {
				continue;
			}

			for (let i = 0; i < useRegexps.length; i++) {
				const regexp = useRegexps[i];

				if (!regexp || !regexp[1].test(text)) {
					continue;
				}

				use.add(regexp[0]);
			}
		}

		if (use.size !== useRegexps.length) {
			const text = link.route.toString();

			for (let i = 0; i < useRegexps.length; i++) {
				const regexp = useRegexps[i];

				if (!regexp || !regexp[1].test(text)) {
					continue;
				}

				use.add(regexp[0]);
			}
		}

		const method = link.method === "WS" ? "GET" : link.method;

		if (!endpoints.has(method)) {
			endpoints.set(method, []);
		}

		const finalPath =
			`${previous.path}${path}${link.path === "/" ? "" : link.path}` ||
			"/";

		endpoints.get(method)?.push({
			chain: link.validator
				? [...mergedChain, link.validator]
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

export const compile = async (app: App, module: AnyModule) => {
	if (!app.memory.has("validator")) {
		app.memory.set("validator", validateStandardSchema);
	}

	const stack = [
		{
			module,
			previous: {
				chain: [],
				path: "",
			},
		},
	] as Stack[];

	while (stack.length > 0) {
		const { module, previous } = stack.pop()!;

		step(stack, app.endpoints, module, previous);
	}

	const methods = Array.from(app.endpoints.keys());

	for (let i = 0; i < methods.length; i++) {
		const method = methods[i];

		if (!method) {
			continue;
		}

		const methodEndpoints = app.endpoints.get(method)?.reverse();

		if (!methodEndpoints || methodEndpoints.length === 0) {
			continue;
		}

		app.routes ??= {};

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

			routes[methodEndpoint.path] ??= {};

			routes[methodEndpoint.path]![
				methodEndpoint.route.method as keyof (typeof routes)[string]
			] = async (request: Bun.BunRequest) => {
				return app.endpoint(
					request,
					methodEndpoint,
					getUrlPathnameRegexp.exec(request.url)?.[1] || request.url,
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
