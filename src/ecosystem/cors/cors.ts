import type { AnyDeveloperContext } from "@/context";
import { module } from "@/module";
import { success } from "@/success";

interface CorsOptions {
	allowHeaders?: string[];
	allowMethods?: string[];
	credentials?: boolean;
	exposeHeaders?: string[];
	maxAge?: number;
	origin?:
		| string
		| ((
				origin: string | undefined,
				context: AnyDeveloperContext,
		  ) => string | undefined);
}

const requestHeadersSplitRegexp = /\s*,\s*/;

export const cors = {
	module({
		allowHeaders,
		allowMethods = [
			"DELETE",
			"GET",
			"HEAD",
			"OPTIONS",
			"PATCH",
			"POST",
			"PUT",
		],
		credentials,
		exposeHeaders,
		maxAge,
		origin = "*",
	}: CorsOptions = {}) {
		return module()

			.middleware(async (context, next) => {
				const { request, response } = context;

				response.headers.set(
					"Access-Control-Allow-Origin",
					typeof origin === "string"
						? origin
						: (origin(
								request.raw.headers.get("Origin") ?? undefined,
								context,
							) ?? "*"),
				);

				if (
					response.headers.get("Access-Control-Allow-Origin") !== "*"
				) {
					response.headers.set(
						"Vary",
						request.raw.headers.get("Vary") || "Origin",
					);
				}

				if (credentials) {
					response.headers.set(
						"Access-Control-Allow-Credentials",
						"true",
					);
				}

				if (exposeHeaders) {
					response.headers.set(
						"Access-Control-Expose-Headers",
						exposeHeaders.join(","),
					);
				}

				if (request.raw.method === "OPTIONS") {
					response.headers.set(
						"Access-Control-Allow-Methods",
						allowMethods.join(","),
					);

					if (maxAge) {
						response.headers.set(
							"Access-Control-Max-Age",
							maxAge.toString(),
						);
					}

					if (!allowHeaders) {
						const requestHeaders = request.raw.headers.get(
							"Access-Control-Request-Headers",
						);

						if (requestHeaders) {
							allowHeaders = requestHeaders.split(
								requestHeadersSplitRegexp,
							);
						}
					}

					if (allowHeaders) {
						response.headers.set(
							"Access-Control-Allow-Headers",
							allowHeaders.join(","),
						);

						response.headers.append(
							"Vary",
							"Access-Control-Request-Headers",
						);
					}
				}

				return await next();
			})

			.route("OPTIONS", "/...path?", () => {
				return success(undefined, 204);
			});
	},
};
