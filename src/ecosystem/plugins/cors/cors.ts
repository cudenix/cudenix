import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";
import { success } from "@/core/success";
import { FreezeEmpty } from "@/utils/objects/empty";

const OPTIONS_RESPONSE = success(undefined, {
	status: 204,
});

interface CorsOptions {
	allowHeaders?: string;
	allowMethods?: string;
	credentials?: boolean;
	exposeHeaders?: string;
	maxAge?: string;
	origin?:
		| string
		| ((
				origin: string | undefined,
				context: AnyDeveloperContext,
		  ) => string | undefined);
}

export const cors = ({
	allowHeaders,
	allowMethods = "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
	credentials,
	exposeHeaders,
	maxAge,
	origin = "*",
}: CorsOptions = FreezeEmpty) => {
	const optionsPairs = ["access-control-allow-methods", allowMethods];

	if (maxAge !== undefined) {
		optionsPairs.push("access-control-max-age", maxAge);
	}

	if (allowHeaders) {
		optionsPairs.push("access-control-allow-headers", allowHeaders);
	}

	optionsPairs.push("content-length", "0");

	const optionsPairsLength = optionsPairs.length;
	const needsMirrorHeaders = !allowHeaders;
	const isStringOrigin = typeof origin === "string";

	const handlePreflight = (headers: Headers, rawHeaders: Headers) => {
		for (let i = 0; i < optionsPairsLength; i += 2) {
			headers.set(optionsPairs[i]!, optionsPairs[i + 1]!);
		}

		if (needsMirrorHeaders) {
			const requestHeaders = rawHeaders.get(
				"access-control-request-headers",
			);

			if (requestHeaders !== null) {
				headers.set("access-control-allow-headers", requestHeaders);

				headers.append("vary", "Access-Control-Request-Headers");
			}
		}
	};

	if (isStringOrigin) {
		const needsVary = origin !== "*";

		if (origin === "*" && credentials === true) {
			return module()
				.middleware((context, next) => {
					const raw = context.request.raw;
					const headers = context.response.headers;
					const rawHeaders = raw.headers;
					const requestOrigin = rawHeaders.get("origin");

					if (requestOrigin !== null) {
						headers.set(
							"access-control-allow-origin",
							requestOrigin,
						);
						headers.append("vary", "Origin");
					} else {
						headers.set("access-control-allow-origin", "*");
					}

					headers.set("access-control-allow-credentials", "true");

					if (exposeHeaders) {
						headers.set(
							"access-control-expose-headers",
							exposeHeaders,
						);
					}

					if (raw.method === "OPTIONS") {
						handlePreflight(headers, rawHeaders);
					}

					return next();
				})

				.route("OPTIONS", "/...path?", () => {
					return OPTIONS_RESPONSE;
				});
		}

		return module()
			.middleware((context, next) => {
				const raw = context.request.raw;
				const headers = context.response.headers;

				headers.set("access-control-allow-origin", origin);

				if (needsVary) {
					headers.append("vary", "Origin");
				}

				if (credentials) {
					headers.set("access-control-allow-credentials", "true");
				}

				if (exposeHeaders) {
					headers.set("access-control-expose-headers", exposeHeaders);
				}

				if (raw.method === "OPTIONS") {
					handlePreflight(headers, raw.headers);
				}

				return next();
			})

			.route("OPTIONS", "/...path?", () => {
				return OPTIONS_RESPONSE;
			});
	}

	return module()
		.middleware((context, next) => {
			const raw = context.request.raw;
			const headers = context.response.headers;
			const rawOrigin = raw.headers.get("origin");
			const resolvedOrigin =
				origin(rawOrigin !== null ? rawOrigin : undefined, context) ??
				"*";

			headers.set("access-control-allow-origin", resolvedOrigin);

			if (resolvedOrigin !== "*") {
				headers.append("vary", "Origin");
			}

			if (credentials) {
				headers.set("access-control-allow-credentials", "true");
			}

			if (exposeHeaders) {
				headers.set("access-control-expose-headers", exposeHeaders);
			}

			if (raw.method === "OPTIONS") {
				handlePreflight(headers, raw.headers);
			}

			return next();
		})

		.route("OPTIONS", "/...path?", () => {
			return OPTIONS_RESPONSE;
		});
};
