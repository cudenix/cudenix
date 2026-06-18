import type { AnyContext } from "@/core/context";
import type { Chain, Endpoint } from "@/core/cudenix";
import { jit } from "@/core/jit";
import { fail, Reply } from "@/core/reply";
import { response } from "@/core/response";
import type { ValidatorPlugin } from "@/core/validator";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";
import type { MaybePromise } from "@/utils/types/maybe-promise";

/**
 * Per-endpoint resolver stored on `endpoint.dispatch`: run the matched endpoint
 * and serialize the result into a `Response`. `compile` assigns one to every
 * endpoint up front — {@link walkDispatch} when the endpoint's JIT is off,
 * {@link jitDispatch} when it is on — so the request path never has to branch on
 * whether a route is JIT-enabled or already compiled.
 *
 * @example
 * ```typescript
 * const run: Dispatch = walkDispatch;
 *
 * const a = await run(endpoint, context);
 *
 * a.status; // 200
 * ```
 */
export type Dispatch = (
	endpoint: Endpoint,
	context: AnyContext,
) => MaybePromise<Response>;

/**
 * Walk the {@link Chain} from `index`, running each middleware, store, and
 * validator, then the route handler, and write the result to
 * `context.response.content`.
 */
const walk = async (
	endpoint: Endpoint,
	context: AnyContext,
	chain: Chain,
	index: number,
) => {
	for (let i = index; i < chain.length; i++) {
		const link = chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "MIDDLEWARE") {
			const returned = await link.handler(context, () =>
				walk(endpoint, context, chain, i + 1),
			);

			if (returned) {
				context.response.content = returned;
			}

			return;
		}

		if (link.type === "STORE") {
			const returned = await link.handler(context);

			if (returned instanceof Reply && !returned.success) {
				context.response.content = returned;

				return;
			}

			merge(context.store, returned);

			continue;
		}

		if (link.type === "VALIDATOR") {
			const validator = context.memory.validator as
				| ValidatorPlugin
				| undefined;

			if (!validator) {
				continue;
			}

			let errors: Record<string, unknown> | undefined;

			for (let j = 0; j < link.keys.length; j++) {
				const key = link.keys[j];

				if (!key) {
					continue;
				}

				const validated = await validator(
					link.request[key],
					context.request[key],
					key,
				);

				if (!validated.success) {
					if (!errors) {
						errors = new Empty();
					}

					errors[key] = validated.content;

					continue;
				}

				context.request[key] = validated.content;
			}

			if (errors) {
				context.response.content = fail(errors, { status: 422 });

				return;
			}
		}
	}

	context.response.content = await endpoint.route.handler(context);
};

/**
 * {@link Dispatch} assigned to a `static` route with an empty chain. Its
 * response is request-independent, so `compile` builds it once into
 * `endpoint.staticResponse`; this just hands back a fresh clone — no chain run,
 * no re-serialization. (When the path is plain, Bun's router serves that same
 * precomputed `Response` natively; this dispatcher covers the regexp /
 * `app.fetch` path and wildcard static routes Bun can't table.)
 */
export const staticDispatch: Dispatch = (endpoint) =>
	endpoint.staticResponse!.clone();

/**
 * {@link Dispatch} assigned when an endpoint's JIT is off: walk the chain on
 * every request and serialize the result.
 */
export const walkDispatch: Dispatch = async (endpoint, context) => {
	await walk(endpoint, context, endpoint.chain, 0);

	return response(context.response.content);
};

/**
 * {@link Dispatch} assigned when an endpoint's JIT is on. The first request
 * walks the chain, then {@link jit} compiles it into a straight-line dispatcher
 * which replaces `endpoint.dispatch` in place — so every later request runs the
 * compiled fast path directly, never walking the chain again.
 */
export const jitDispatch: Dispatch = async (endpoint, context) => {
	await walk(endpoint, context, endpoint.chain, 0);

	const jitted = jit(endpoint);

	endpoint.dispatch = async (endpoint, context) => {
		await jitted(endpoint, context);

		return response(context.response.content);
	};

	return response(context.response.content);
};
