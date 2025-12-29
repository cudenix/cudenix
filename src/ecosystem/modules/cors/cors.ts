import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";
import { success } from "@/core/success";
import { Empty } from "@/utils/objects/empty";

export interface CorsOptions {
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

export const cors = (
	{
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
	}: CorsOptions = new Empty(),
) => {
	return module()

		.middleware(async (context, next) => {
			const {
				request: { raw },
				response: { headers },
			} = context;

			const requestOrigin = raw.headers.get("Origin") ?? "";

			let resolvedOrigin: string;

			if (typeof origin === "string") {
				resolvedOrigin =
					credentials && origin === "*" ? requestOrigin : origin;
			} else {
				resolvedOrigin = origin(requestOrigin, context) ?? "*";
			}

			headers.set("Access-Control-Allow-Origin", resolvedOrigin);

			if (resolvedOrigin !== "*") {
				const vary = headers.get("Vary");

				headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
			}

			if (credentials) {
				headers.set("Access-Control-Allow-Credentials", "true");
			}

			if (exposeHeaders) {
				headers.set(
					"Access-Control-Expose-Headers",
					exposeHeaders.join(","),
				);
			}

			if (raw.method === "OPTIONS") {
				headers.set(
					"Access-Control-Allow-Methods",
					allowMethods.join(","),
				);

				if (maxAge !== undefined) {
					headers.set("Access-Control-Max-Age", maxAge.toString());
				}

				let resolvedAllowHeaders = allowHeaders;

				if (!resolvedAllowHeaders) {
					const requestHeaders = raw.headers.get(
						"Access-Control-Request-Headers",
					);

					if (requestHeaders) {
						resolvedAllowHeaders = requestHeaders.split(
							requestHeadersSplitRegexp,
						);
					}
				}

				if (resolvedAllowHeaders) {
					headers.set(
						"Access-Control-Allow-Headers",
						resolvedAllowHeaders.join(","),
					);

					const vary = headers.get("Vary");

					headers.set(
						"Vary",
						vary
							? `${vary}, Access-Control-Request-Headers`
							: "Access-Control-Request-Headers",
					);
				}

				headers.set("Content-Length", "0");
			}

			return next();
		})

		.route("OPTIONS", "/...path?", () => {
			return success(undefined, {
				status: 204,
				transform: false,
			});
		});
};
