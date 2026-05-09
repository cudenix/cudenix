import type { MaybePromise } from "@/types/maybe-promise";

export const memoizeRequest = (
	handler: (request: Request) => MaybePromise<Response>,
) => {
	let cached: Response | undefined;

	return (request: Request) => {
		if (cached !== undefined) {
			return cached.clone();
		}

		const result = handler(request);

		if (result instanceof Promise) {
			return result.then((response) => {
				if (cached === undefined) {
					cached = response.clone();
				}

				return response;
			});
		}

		if (cached === undefined) {
			cached = result.clone();
		}

		return result;
	};
};
