import type { App } from "@/core/app";
import { module } from "@/core/module";
import { success } from "@/core/success";
import { scalar } from "@/ecosystem/plugins/openapi/scalar";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

const PARAM_RE = /(?::|\.{3})(\w+)\??/g;

const PARAM_LOCATION = {
	cookies: "cookie",
	headers: "header",
	params: "path",
	query: "query",
} as Record<string, string>;

interface OpenapiPluginOptions {
	description?: string;
	title?: string;
	version?: string;
}

interface OpenapiModuleOptions {
	path?: `/${string}`;
}

export const initializeOpenapi = (
	toJsonSchema: (schema: any) => Record<string, any>,
	{
		description = "Cudenix Documentation",
		title = "Cudenix Documentation",
		version = "0.0.1",
	}: OpenapiPluginOptions = FreezeEmpty,
) =>
	function initializeOpenapi(this: App) {
		const paths = new Empty();
		const tags = new Set<string>();

		for (const [method, methodData] of this.methods) {
			if (!methodData) {
				continue;
			}

			const lowerMethod = method.toLowerCase();

			for (let j = 0; j < methodData.endpoints.length; j++) {
				const endpoint = methodData.endpoints[j];

				if (!endpoint) {
					continue;
				}

				let paramNames: string[] | undefined;
				let paramOptional: boolean[] | undefined;
				let paramSpread: boolean[] | undefined;

				const path = endpoint.path.replace(PARAM_RE, (match, name) => {
					if (!paramNames) {
						paramNames = [];
						paramOptional = [];
						paramSpread = [];
					}

					paramNames.push(name);
					paramOptional!.push(
						match.charCodeAt(match.length - 1) === 63,
					);
					paramSpread!.push(match.charCodeAt(0) === 46);

					return `{${name}}`;
				});

				const operation = new Empty();

				for (let k = 0; k < endpoint.chain.length; k++) {
					const link = endpoint.chain[k];

					if (!link || link.type !== "VALIDATOR") {
						continue;
					}

					const keys = link.keys;

					for (let l = 0; l < keys.length; l++) {
						const key = keys[l];

						if (!key) {
							continue;
						}

						if (key !== "body") {
							const _in = PARAM_LOCATION[key] ?? key;
							const schema = toJsonSchema(link.request[key]);

							operation.parameters ??= [];

							if (schema.type === "object") {
								const properties = schema.properties as Record<
									string,
									unknown
								>;
								const required = schema.required as
									| string[]
									| undefined;

								for (const propKey in properties) {
									(
										operation.parameters as Record<
											string,
											unknown
										>[]
									).push({
										in: _in,
										name: propKey,
										required:
											(required &&
												required.indexOf(propKey) !==
													-1) ||
											false,
										schema: properties[propKey],
									});
								}

								continue;
							}

							(
								operation.parameters as Record<
									string,
									unknown
								>[]
							).push({
								in: _in,
								schema,
							});

							continue;
						}

						operation.requestBody ??= {
							content: new Empty(),
						};

						const bodySchema = toJsonSchema(link.request[key]);

						const content = (
							operation.requestBody as Record<string, unknown>
						).content as Record<string, unknown>;

						content["application/json"] = {
							schema: bodySchema,
						};
						content["multipart/form-data"] = {
							schema: bodySchema,
						};
						content["text/plain"] = {
							schema: bodySchema,
						};
					}
				}

				if (paramNames) {
					for (let k = 0; k < paramNames.length; k++) {
						const name = paramNames[k];

						if (!name) {
							continue;
						}

						const existing = operation.parameters as
							| Record<string, unknown>[]
							| undefined;

						let found = false;

						if (existing) {
							for (let m = 0; m < existing.length; m++) {
								const existingParam = existing[m];

								if (
									existingParam &&
									existingParam.in === "path" &&
									existingParam.name === name
								) {
									found = true;

									break;
								}
							}
						}

						if (found) {
							continue;
						}

						operation.parameters ??= [];

						(
							operation.parameters as Record<string, unknown>[]
						).push({
							in: "path",
							name,
							required: !paramOptional?.[k],
							schema: {
								pattern: paramSpread?.[k] ? ".*" : undefined,
								type: "string",
							},
						});
					}
				}

				if (path.charCodeAt(0) === 47 && path.charCodeAt(1) !== 123) {
					const slashIndex = path.indexOf("/", 1);
					const tag =
						slashIndex === -1
							? path.substring(1)
							: path.substring(1, slashIndex);

					if (tag) {
						operation.tags = [tag];

						tags.add(tag);
					}
				}

				paths[path] ??= new Empty();

				(paths[path] as Record<string, unknown>)[lowerMethod] =
					operation;
			}
		}

		this.memory.set("openapi", {
			info: {
				description,
				title,
				version,
			},
			openapi: "3.1.0",
			paths,
			tags: Array.from(tags, (tag) => {
				return {
					name: tag,
				};
			}),
		});
	};

export const openapi = ({ path }: OpenapiModuleOptions = FreezeEmpty) => {
	const url = (path ?? "/openapi") as `/${string}`;

	let cachedHtml: string | undefined;
	let cachedJson: string | undefined;

	return module()
		.route("GET", url, ({ memory, response: { headers } }) => {
			headers.set("Content-Type", "text/html");

			if (!cachedHtml) {
				cachedJson ??= JSON.stringify(memory.get("openapi"));

				cachedHtml = scalar(
					"Cudenix Documentation",
					cachedJson,
					JSON.stringify({}),
				);
			}

			return success(cachedHtml, {
				transform: false,
			});
		})

		.route("GET", `${url}/json`, ({ memory }) => {
			if (!cachedJson) {
				cachedJson = JSON.stringify(memory.get("openapi"));
			}

			return success(cachedJson, {
				transform: false,
			});
		});
};
