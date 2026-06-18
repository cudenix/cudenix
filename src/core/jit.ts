import type { AnyContext } from "@/core/context";
import type { Chain, Endpoint } from "@/core/cudenix";
import { fail, Reply } from "@/core/reply";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";

/**
 * Compiled per-endpoint dispatcher produced by {@link jit}: run the endpoint's
 * {@link Chain} and route handler as straight-line code, writing the result to
 * `context.response.content` without `walk`'s per-link branching or recursion.
 *
 * @example
 * ```typescript
 * const run: JittedDispatch = jit(endpoint);
 *
 * await run(endpoint, context);
 *
 * context.response.content; // resolved reply
 * ```
 */
export type JittedDispatch = (
	endpoint: Endpoint,
	context: AnyContext,
) => Promise<void>;

/**
 * Emit the source for the {@link Chain} links from `index` onward, ending with
 * the route handler call. A `MIDDLEWARE` nests the rest of the chain in its
 * `next` closure, so it runs only when the handler calls `next`.
 */
const generate = (chain: Chain, index: number): string => {
	if (index >= chain.length) {
		return "context.response.content = await endpoint.route.handler(context);";
	}

	const link = chain[index];

	if (!link) {
		return generate(chain, index + 1);
	}

	if (link.type === "MIDDLEWARE") {
		return `{
			const next_${index} = async () => {
				${generate(chain, index + 1)}
			};

			const returned_${index} = await chain[${index}].handler(context, next_${index});

			if (returned_${index}) {
				context.response.content = returned_${index};
			}
		}`;
	}

	if (link.type === "STORE") {
		return `{
			const returned_${index} = await chain[${index}].handler(context);

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				context.response.content = returned_${index};

				return;
			}

			merge(context.store, returned_${index});
		}

		${generate(chain, index + 1)}`;
	}

	if (link.type === "VALIDATOR") {
		let keys = "";

		for (let i = 0; i < link.keys.length; i++) {
			const key = JSON.stringify(link.keys[i]);

			keys += `{
				const validated = await validator_${index}(
					chain[${index}].request[${key}],
					context.request[${key}],
					${key},
				);

				if (validated.success) {
					context.request[${key}] = validated.content;
				} else {
					(errors_${index} ??= new Empty())[${key}] = validated.content;
				}
			}`;
		}

		return `{
			const validator_${index} = context.memory.validator;

			if (validator_${index}) {
				let errors_${index};

				${keys}

				if (errors_${index}) {
					context.response.content = fail(errors_${index}, { status: 422 });

					return;
				}
			}
		}

		${generate(chain, index + 1)}`;
	}

	return generate(chain, index + 1);
};

/**
 * Compile an {@link Endpoint}'s chain into a {@link JittedDispatch}. The body is
 * built once by {@link generate}, then a `new Function` factory closes over
 * `chain` and the runtime helpers it references and returns the dispatcher.
 *
 * @example
 * ```typescript
 * const a = new Cudenix(
 *   new Module()
 *     .store(() => ({ a: "v1" }))
 *     .route("GET", "/a", (context) => ok(context.store.a)),
 * );
 *
 * a.compile();
 *
 * const endpoint = a.methods.GET.endpoints[0];
 *
 * const run = jit(endpoint);
 *
 * await run(endpoint, context);
 * ```
 */
export const jit = (endpoint: Endpoint): JittedDispatch => {
	const chain = endpoint.chain;

	const factory = new Function(
		"chain",
		"Reply",
		"merge",
		"Empty",
		"fail",
		`return async (endpoint, context) => {\n${generate(chain, 0)}\n};`,
	) as (
		chain: Chain,
		reply: typeof Reply,
		mergeObjects: typeof merge,
		empty: typeof Empty,
		failReply: typeof fail,
	) => JittedDispatch;

	return factory(chain, Reply, merge, Empty, fail);
};
