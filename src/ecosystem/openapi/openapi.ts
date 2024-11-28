import { scalar } from "@/ecosystem/openapi/scalar";
import { type App, success } from "@/index";
import { module } from "@/module";
import { Empty } from "@/utils/empty";

type AddonToJsonSchema = (schema: any) => Record<string, unknown>;

interface AddonOptions {
	description?: string;
	title?: string;
	version?: string;
}

interface ModuleOptions {
	path?: `/${string}`;
}

const endsWithQuestionMarkRegexp = /\?$/;
const endsWithSRegexp = /s$/;
const startsWithEllipsisRegexp = /^\.{3}/;
const startsWithSlashRegexp = /^\/{/;

export const openapi = {
	addon(
		toJsonSchema: AddonToJsonSchema,
		{
			description = "Cudenix Documentation",
			title = "Cudenix Documentation",
			version = "0.0.1",
		}: AddonOptions = {},
	) {
		return function (this: App) {
			const paths = new Empty();
			const methods = Array.from(this.endpoints.keys());
			const tags = new Set<string>();

			for (let i = 0; i < methods.length; i++) {
				const endpoints = this.endpoints.get(methods[i])!;

				for (let j = 0; j < endpoints.length; j++) {
					const endpoint = endpoints[j];
					const path = endpoint.path
						.replaceAll(/:(\w+)/g, "{$1}")
						.replaceAll(/\.{3}(\w+)/g, "{$1}");
					const operation = new Empty();

					for (let k = 0; k < endpoint.chain.length; k++) {
						const link = endpoint.chain[k];

						if (link.type !== "VALIDATOR") {
							continue;
						}

						const keys = Object.keys(link.request);

						for (let l = 0; l < keys.length; l++) {
							const key = keys[l];

							if (!link.request[key]) {
								continue;
							}

							if (key !== "body") {
								const _in = key.replace(endsWithSRegexp, "");
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
										const property = (
											schema.properties as Record<
												string,
												unknown
											>
										)[keys[m]];

										(
											operation.parameters as Record<
												string,
												unknown
											>[]
										).push({
											in: _in,
											name: keys[m],
											schema: property,
											required:
												(
													schema.required as
														| string[]
														| undefined
												)?.includes(keys[m]) ?? false,
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

							const contentType = [
								"application/json",
								"multipart/form-data",
								"text/plain",
							];

							for (let m = 0; m < contentType.length; m++) {
								(
									(
										operation.requestBody as Record<
											string,
											unknown
										>
									).content as Record<string, unknown>
								)[contentType[m]] = {
									schema: toJsonSchema(link.request[key]),
								};
							}
						}
					}

					const params = endpoint.path.match(/(?::|\.{3})(\w+)\??/g);

					if (params) {
						for (let k = 0; k < params.length; k++) {
							const param = params[k];
							const name = param
								.replaceAll(/^[:.]*/g, "")
								.replace("?", "");

							if (
								(
									operation.parameters as
										| Record<string, unknown>[]
										| undefined
								)?.some(
									(parameter) =>
										parameter.in === "path" &&
										parameter.name === name,
								)
							) {
								continue;
							}

							operation.parameters ??= [];

							(
								operation.parameters as Record<
									string,
									unknown
								>[]
							).push({
								in: "path",
								name,
								required:
									!endsWithQuestionMarkRegexp.test(param),
								schema: {
									pattern: startsWithEllipsisRegexp.test(
										param,
									)
										? ".*"
										: undefined,
									type: "string",
								},
							});
						}
					}

					if (!startsWithSlashRegexp.test(path)) {
						const tag = path.split("/")[1];

						operation.tags = [tag];

						tags.add(tag);
					}

					paths[path] ??= {};

					(paths[path] as Record<string, unknown>)[
						methods[i].toLowerCase()
					] = operation;
				}
			}

			this.memory.set("openapi", {
				info: {
					title,
					description,
					version,
				},
				openapi: "3.1.0",
				paths,
				tags: Array.from(tags).map((tag) => ({
					name: tag,
				})),
			});

			return "openapi";
		};
	},

	module(options?: ModuleOptions) {
		const url = `${options?.path ?? "/openapi"}` as `/${string}`;

		return module()
			.route("GET", url, ({ memory, response: { headers } }) => {
				headers.set("content-type", "text/html");

				return success(
					scalar(
						"Cudenix Documentation",
						JSON.stringify(memory.get("openapi")),
						JSON.stringify({}),
					),
				);
			})

			.route("GET", `${url}/json`, ({ memory }) => {
				return success(memory.get("openapi"));
			});
	},
};
