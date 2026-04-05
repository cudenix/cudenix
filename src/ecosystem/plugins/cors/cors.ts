import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";
import { success } from "@/core/success";
import { FreezeEmpty } from "@/utils/objects/empty";

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

	const optionsResponse = success(undefined, {
		status: 204,
		transform: false,
	});

	if (isStringOrigin) {
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

					// credentials is always true in this branch
					headers.set("access-control-allow-credentials", "true");

					if (exposeHeaders) {
						headers.set(
							"access-control-expose-headers",
							exposeHeaders,
						);
					}

					if (raw.method === "OPTIONS") {
						for (let i = 0; i < optionsPairsLength; i += 2) {
							headers.set(optionsPairs[i], optionsPairs[i + 1]);
						}

						if (needsMirrorHeaders) {
							const rh = rawHeaders.get(
								"access-control-request-headers",
							);

							if (rh !== null) {
								headers.set("access-control-allow-headers", rh);

								headers.append(
									"vary",
									"Access-Control-Request-Headers",
								);
							}
						}
					}

					return next();
				})

				.route("OPTIONS", "/...path?", () => optionsResponse);
		}

		if (origin === "*") {
			return module()

				.middleware((context, next) => {
					const raw = context.request.raw;
					const headers = context.response.headers;

					headers.set("access-control-allow-origin", "*");

					if (credentials) {
						headers.set("access-control-allow-credentials", "true");
					}

					if (exposeHeaders) {
						headers.set(
							"access-control-expose-headers",
							exposeHeaders,
						);
					}

					if (raw.method === "OPTIONS") {
						for (let i = 0; i < optionsPairsLength; i += 2) {
							headers.set(optionsPairs[i], optionsPairs[i + 1]);
						}

						if (needsMirrorHeaders) {
							const rh = raw.headers.get(
								"access-control-request-headers",
							);

							if (rh !== null) {
								headers.set("access-control-allow-headers", rh);

								headers.append(
									"vary",
									"Access-Control-Request-Headers",
								);
							}
						}
					}

					return next();
				})

				.route("OPTIONS", "/...path?", () => optionsResponse);
		}

		return module()

			.middleware((context, next) => {
				const raw = context.request.raw;
				const headers = context.response.headers;

				headers.set("access-control-allow-origin", origin);
				headers.append("vary", "Origin");

				if (credentials) {
					headers.set("access-control-allow-credentials", "true");
				}

				if (exposeHeaders) {
					headers.set("access-control-expose-headers", exposeHeaders);
				}

				if (raw.method === "OPTIONS") {
					for (let i = 0; i < optionsPairsLength; i += 2) {
						headers.set(optionsPairs[i], optionsPairs[i + 1]);
					}

					if (needsMirrorHeaders) {
						const rh = raw.headers.get(
							"access-control-request-headers",
						);

						if (rh !== null) {
							headers.set("access-control-allow-headers", rh);

							headers.append(
								"vary",
								"Access-Control-Request-Headers",
							);
						}
					}
				}

				return next();
			})

			.route("OPTIONS", "/...path?", () => {
				return optionsResponse;
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
				for (let i = 0; i < optionsPairsLength; i += 2) {
					headers.set(optionsPairs[i], optionsPairs[i + 1]);
				}

				if (needsMirrorHeaders) {
					const rh = raw.headers.get(
						"access-control-request-headers",
					);

					if (rh !== null) {
						headers.set("access-control-allow-headers", rh);

						headers.append(
							"vary",
							"Access-Control-Request-Headers",
						);
					}
				}
			}

			return next();
		})

		.route("OPTIONS", "/...path?", () => {
			return optionsResponse;
		});
};
