import type { App } from "@/core/app";
import { module } from "@/core/module";
import { success } from "@/core/success";
import { scalar } from "@/ecosystem/plugins/openapi/scalar";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

const CONTENT_TYPES = [
	"application/json",
	"multipart/form-data",
	"text/plain",
] as const;

interface OpenapiPluginOptions {
	description?: string;
	title?: string;
	version?: string;
}

interface OpenapiModuleOptions {
	path?: `/${string}`;
}

export const plugin = (
	toJsonSchema: (schema: any) => Record<string, any>,
	{
		description = "Cudenix Documentation",
		title = "Cudenix Documentation",
		version = "0.0.1",
	}: OpenapiPluginOptions = FreezeEmpty,
) => {
	return function (this: App) {
		const paths = new Empty();
		const tags = new Set<string>();

		for (const [method, methodData] of this.methods) {
			if (!methodData) {
				continue;
			}

			for (let j = 0; j < methodData.endpoints.length; j++) {
				const endpoint = methodData.endpoints[j];

				if (!endpoint) {
					continue;
				}

				const path = endpoint.path.replaceAll(
					/(?::|\.{3})(\w+)\??/g,
					"{$1}",
				);

				const operation = new Empty();

				for (let k = 0; k < endpoint.chain.length; k++) {
					const link = endpoint.chain[k];

					if (!link || link.type !== "VALIDATOR") {
						continue;
					}

					const keys = Object.keys(link.request);

					for (let l = 0; l < keys.length; l++) {
						const key = keys[l];

						if (!key) {
							continue;
						}

						if (key !== "body") {
							const _in =
								key === "params"
									? "path"
									: key.endsWith("s")
										? key.slice(0, -1)
										: key;
							const schema = toJsonSchema(link.request[key]);

							operation.parameters ??= [];

							if (schema.type === "object") {
								const keys = Object.keys(
									schema.properties as Record<
										string,
										unknown
									>,
								);

								for (let m = 0; m < keys.length; m++) {
									const key = keys[m];

									if (!key) {
										continue;
									}

									const property = (
										schema.properties as Record<
											string,
											unknown
										>
									)[key];

									(
										operation.parameters as Record<
											string,
											unknown
										>[]
									).push({
										in: _in,
										name: key,
										required:
											((
												schema.required as
													| string[]
													| undefined
											)?.indexOf(key) ?? -1) !== -1,
										schema: property,
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

						for (let m = 0; m < CONTENT_TYPES.length; m++) {
							const contentType = CONTENT_TYPES[m];

							if (!contentType) {
								continue;
							}

							(
								(
									operation.requestBody as Record<
										string,
										unknown
									>
								).content as Record<string, unknown>
							)[contentType] = {
								schema: bodySchema,
							};
						}
					}
				}

				const params = endpoint.path.match(/(?::|\.{3})(\w+)\??/g);

				if (params) {
					for (let k = 0; k < params.length; k++) {
						const param = params[k];

						if (!param) {
							continue;
						}

						const name = param.slice(
							param.charCodeAt(0) === 46 ? 3 : 1,
							param.charCodeAt(param.length - 1) === 63
								? param.length - 1
								: param.length,
						);

						if (
							(
								operation.parameters as
									| Record<string, unknown>[]
									| undefined
							)?.some((parameter) => {
								return (
									parameter.in === "path" &&
									parameter.name === name
								);
							})
						) {
							continue;
						}

						operation.parameters ??= [];

						(
							operation.parameters as Record<string, unknown>[]
						).push({
							in: "path",
							name,
							required: !param.endsWith("?"),
							schema: {
								pattern: param.startsWith("...")
									? ".*"
									: undefined,
								type: "string",
							},
						});
					}
				}

				if (!path.startsWith("/{")) {
					const tag = path.split("/")[1];

					if (tag) {
						operation.tags = [tag];

						tags.add(tag);
					}
				}

				paths[path] ??= new Empty();

				(paths[path] as Record<string, unknown>)[method.toLowerCase()] =
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

		return "openapi";
	};
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
