import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";
import { success } from "@/core/success";
import { FreezeEmpty } from "@/utils/objects/empty";

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

export const cors = ({
	allowHeaders,
	allowMethods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
	credentials,
	exposeHeaders,
	maxAge,
	origin = "*",
}: CorsOptions = FreezeEmpty) => {
	const isStringOrigin = typeof origin === "string";
	const isWildcardWithCredentials =
		isStringOrigin && credentials === true && origin === "*";
	const joinedAllowHeaders = allowHeaders?.join(",");
	const joinedAllowMethods = allowMethods.join(",");
	const joinedExposeHeaders = exposeHeaders?.join(",");
	const needsVary = isStringOrigin && origin !== "*";
	const stringMaxAge = maxAge?.toString();

	return module()

		.middleware((context, next) => {
			const raw = context.request.raw;
			const headers = context.response.headers;

			if (isWildcardWithCredentials) {
				const requestOrigin = raw.headers.get("origin") ?? origin;

				headers.set("access-control-allow-origin", requestOrigin);

				if (requestOrigin !== origin) {
					headers.append("vary", "Origin");
				}
			} else if (isStringOrigin) {
				headers.set("access-control-allow-origin", origin);

				if (needsVary) {
					headers.append("vary", "Origin");
				}
			} else {
				const requestOrigin = raw.headers.get("origin") ?? undefined;
				const resolvedOrigin = origin(requestOrigin, context) ?? "*";

				headers.set("access-control-allow-origin", resolvedOrigin);

				if (resolvedOrigin !== "*") {
					headers.append("vary", "Origin");
				}
			}

			if (credentials) {
				headers.set("access-control-allow-credentials", "true");
			}

			if (joinedExposeHeaders) {
				headers.set(
					"access-control-expose-headers",
					joinedExposeHeaders,
				);
			}

			if (raw.method === "OPTIONS") {
				headers.set("access-control-allow-methods", joinedAllowMethods);

				if (stringMaxAge !== undefined) {
					headers.set("access-control-max-age", stringMaxAge);
				}

				if (joinedAllowHeaders) {
					headers.set(
						"access-control-allow-headers",
						joinedAllowHeaders,
					);
				} else {
					const requestHeaders = raw.headers.get(
						"access-control-request-headers",
					);

					if (requestHeaders) {
						headers.set(
							"access-control-allow-headers",
							requestHeaders,
						);

						headers.append(
							"vary",
							"Access-Control-Request-Headers",
						);
					}
				}

				headers.set("content-length", "0");
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
