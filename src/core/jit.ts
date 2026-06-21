import { Context } from "@/core/context";
import type { Cudenix, Endpoint, EndpointChain } from "@/core/cudenix";
import { type Dispatch, serialize } from "@/core/dispatch";
import { fail, Reply } from "@/core/reply";
import type { AnyRouteFn } from "@/core/route";
import { stream } from "@/core/sse";
import type { ValidatorRequest } from "@/core/validator";
import { parseBody } from "@/utils/bodies/parse-body";
import { parseCookies } from "@/utils/cookies/parse-cookies";
import { isAsync } from "@/utils/functions/is-async";
import { Empty } from "@/utils/objects/empty";
import { merge } from "@/utils/objects/merge";
import { parseParams } from "@/utils/urls/parse-params";
import { parseQuery } from "@/utils/urls/parse-query";

/**
 * Whether `fn` is declared `async` — the analyzer's signal for where the
 * generated dispatcher must emit `await`. An `async` function always returns a
 * promise, so its call is awaited; a plain function is called bare, with no
 * `await` and no runtime promise/thenable check.
 *
 * The primary signal is the source text read with `.toString()`. A bound async
 * function (`asyncFn.bind(this)` — an ordinary pattern for class-method
 * handlers) is an exotic function whose source is `"function () { [native code]
 * }"`: it does not start with `async` even though it always returns a promise,
 * so {@link isAsync} (a prototype check) backs the text up to keep that case
 * awaited. Combining the two only ever adds an `await` — it never drops one — so
 * no genuinely-async handler is misread as synchronous.
 *
 * This is the framework's contract: declare a handler `async` exactly when its
 * result must be awaited. `async () => ok(...)` is still detected as `async` and
 * awaited — declaring `async` is the developer's explicit opt-in to that cost,
 * so plain handlers (the common case) stay fully synchronous.
 *
 * @example
 * ```typescript
 * isAsyncSource(async () => {}); // true
 * isAsyncSource(() => {}); // false
 * isAsyncSource((async () => {}).bind(null)); // true
 * ```
 */
const isAsyncSource = (fn: (...args: any[]) => unknown): boolean =>
	fn.toString().startsWith("async") || isAsync(fn);

/**
 * Source for loading each request slot, emitted only when a validator declares
 * that slot. A slot the chain never validates is never parsed — the central
 * specialization of the compiled dispatcher.
 *
 * Only `body` is awaited (`parseBody` reads the stream); the rest are
 * synchronous. `params` resolves from `BunRequest.params` when Bun's native
 * router served the route — there is no regexp match to read — and falls back to
 * {@link parseParams} over `context.match` on the regexp / `app.fetch` path. The
 * `"cookies" in raw` probe is the same `BunRequest` discriminator the rest of
 * the framework uses.
 */
const PARSERS: Record<keyof ValidatorRequest, string> = {
	body: "context.request.body = await parseBody(context.request.raw);",
	cookies:
		'context.request.cookies = parseCookies(context.request.raw.headers.get("cookie") ?? "");',
	headers: "context.request.headers = context.request.raw.headers.toJSON();",
	params: 'context.request.params = "cookies" in context.request.raw ? context.request.raw.params : parseParams(context.match, this.paramKeys, this.matchOffset, this.restKeys);',
	query: "context.request.query = parseQuery(context.request.raw.url);",
};

/**
 * Whether the code generated from `index` onward awaits anything — i.e. whether
 * its scope must be `async`. A `STORE`/`VALIDATOR` keeps its tail in the same
 * scope, so the walk continues past it; a `MIDDLEWARE` nests its tail in a
 * separate `next` closure, so the scope ends at the middleware call, whose own
 * `await` depends on whether that closure awaits. Validators are always awaited
 * — the plugin's `async`-ness is set at runtime (it is unknown when `compile`
 * runs the analyzer) and the awaited `parseBody` of a `body` slot rides along.
 *
 * The decision is purely static, read off each handler's source with
 * {@link isAsyncSource}. The one ergonomic exception is a middleware that only
 * forwards through `next()` — its result is a promise exactly when the tail is
 * async, which this already accounts for, so plain gating middlewares
 * (`(context, next) => ok ? next() : fail(...)`) need no `async`.
 */
const scopeNeedsAwait = (
	chain: EndpointChain,
	index: number,
	sse: boolean,
	routeHandler: AnyRouteFn,
): boolean => {
	for (let i = index; i < chain.length; i++) {
		const link = chain[i];

		if (!link) {
			continue;
		}

		if (link.type === "STORE") {
			if (isAsyncSource(link.handler)) {
				return true;
			}

			continue;
		}

		if (link.type === "VALIDATOR") {
			return true;
		}

		if (link.type === "MIDDLEWARE") {
			return (
				isAsyncSource(link.handler) ||
				scopeNeedsAwait(chain, i + 1, sse, routeHandler)
			);
		}
	}

	return !sse && isAsyncSource(routeHandler);
};

/**
 * Emit the source for the {@link EndpointChain} links from `index` onward, ending with
 * the route handler call and `return serialize(context)` so the compiled
 * dispatcher resolves the `Response` inline. A `MIDDLEWARE` nests the rest of
 * the chain in its `next` closure, so it runs only when the handler calls
 * `next`; `nested` tracks whether the emitted code lives inside such a closure,
 * where a short-circuit `return`s from the closure rather than the dispatcher
 * and the trailing `serialize` is left to the enclosing scope.
 *
 * A `VALIDATOR` first loads each slot it declares — once across the whole chain,
 * tracked by `parsed` — via {@link PARSERS}, so a later validator for the same
 * slot reuses the earlier validator's output. Slots no validator touches emit no
 * parse call at all. Each call is emitted with its `await` resolved at compile
 * time by {@link isAsyncSource}; the generated code performs no runtime "is it a
 * promise" check.
 */
const generate = (
	chain: EndpointChain,
	index: number,
	sse: boolean,
	routeHandler: AnyRouteFn,
	parsed: Set<string>,
	nested: boolean,
): string => {
	if (index >= chain.length) {
		if (sse) {
			const body = `const generator = this.route.handler(context);

				context.server?.timeout(context.request.raw, 0);

				context.response.content = stream(generator);`;

			return nested ? body : `${body}\n\nreturn serialize(context);`;
		}

		const call = isAsyncSource(routeHandler)
			? "context.response.content = await this.route.handler(context);"
			: "context.response.content = this.route.handler(context);";

		return nested ? call : `${call}\n\nreturn serialize(context);`;
	}

	const link = chain[index];

	if (!link) {
		return generate(chain, index + 1, sse, routeHandler, parsed, nested);
	}

	if (link.type === "MIDDLEWARE") {
		const tailAsync = scopeNeedsAwait(chain, index + 1, sse, routeHandler);

		const call =
			isAsyncSource(link.handler) || tailAsync
				? `const returned_${index} = await chain[${index}].handler(context, next_${index});`
				: `const returned_${index} = chain[${index}].handler(context, next_${index});`;

		const block = `{
			const next_${index} = ${tailAsync ? "async " : ""}() => {
				${generate(chain, index + 1, sse, routeHandler, parsed, true)}
			};

			${call}

			if (returned_${index}) {
				context.response.content = returned_${index};
			}
		}`;

		return nested ? block : `${block}\n\nreturn serialize(context);`;
	}

	if (link.type === "STORE") {
		const call = isAsyncSource(link.handler)
			? `const returned_${index} = await chain[${index}].handler(context);`
			: `const returned_${index} = chain[${index}].handler(context);`;

		return `{
			${call}

			if (returned_${index} instanceof Reply && !returned_${index}.success) {
				context.response.content = returned_${index};

				return${nested ? "" : " serialize(context)"};
			}

			merge(context.store, returned_${index});
		}

		${generate(chain, index + 1, sse, routeHandler, parsed, nested)}`;
	}

	if (link.type === "VALIDATOR") {
		let keys = "";

		for (let i = 0; i < link.keys.length; i++) {
			const key = link.keys[i];

			if (!key) {
				continue;
			}

			let load = "";

			if (!parsed.has(key)) {
				parsed.add(key);

				load = PARSERS[key];
			}

			const json = JSON.stringify(key);

			const validate = `{
					const validated = await validator_${index}(
						chain[${index}].request[${json}],
						context.request[${json}],
						${json},
					);

					if (validated.success) {
						context.request[${json}] = validated.content;
					} else {
						(errors_${index} ??= new Empty())[${json}] = validated.content;
					}
				}`;

			keys += load ? `\n\n${load}\n\n${validate}` : `\n\n${validate}`;
		}

		return `{
			const validator_${index} = context.memory.validator;

			if (validator_${index}) {
				let errors_${index};

				${keys}

				if (errors_${index}) {
					context.response.content = fail(errors_${index}, { status: 422 });

					return${nested ? "" : " serialize(context)"};
				}
			}
		}

		${generate(chain, index + 1, sse, routeHandler, parsed, nested)}`;
	}

	return generate(chain, index + 1, sse, routeHandler, parsed, nested);
};

/**
 * Compile an {@link Endpoint}'s chain into its {@link Dispatch}. `compile` calls
 * this once per non-static endpoint, so every route is specialized up front —
 * there is no first-request warm-up and every request runs the same compiled
 * path. {@link generate} builds the body once, then a `new Function` factory
 * closes over `chain` and the runtime helpers it references and returns the
 * dispatcher.
 *
 * The analyzer inspects each handler, middleware, and validator at compile time
 * and emits the minimum code a route needs: `await` only where a handler is
 * `async` (or a middleware whose tail is), so a fully synchronous chain compiles
 * to a synchronous dispatcher with no `await` and no promise allocation; and a
 * parse call (`parseBody`, `parseQuery`, …) only for the request slots a
 * validator actually declares, each parsed at most once.
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
 * // Each call builds a fresh function with identical generated source.
 * endpoint.dispatch.toString() === jit(endpoint, a).toString(); // true
 * ```
 */
export const jit = (endpoint: Endpoint, app: Cudenix): Dispatch => {
	const chain = endpoint.chain;

	const sse = endpoint.route.sse;
	const routeHandler = endpoint.route.handler;

	const async = scopeNeedsAwait(chain, 0, sse, routeHandler) ? "async " : "";

	const factory = new Function(
		"app",
		"Context",
		"chain",
		"serialize",
		"Reply",
		"merge",
		"Empty",
		"fail",
		"stream",
		"parseBody",
		"parseCookies",
		"parseParams",
		"parseQuery",
		`return ${async}function (request, match) {\nconst context = new Context(app, this, request, match);\n\n${generate(chain, 0, sse, routeHandler, new Set(), false)}\n};`,
	) as (
		app: Cudenix,
		context: typeof Context,
		chain: EndpointChain,
		serializeContext: typeof serialize,
		reply: typeof Reply,
		mergeObjects: typeof merge,
		empty: typeof Empty,
		failReply: typeof fail,
		sseStream: typeof stream,
		bodyParser: typeof parseBody,
		cookieParser: typeof parseCookies,
		paramsParser: typeof parseParams,
		queryParser: typeof parseQuery,
	) => Dispatch;

	return factory(
		app,
		Context,
		chain,
		serialize,
		Reply,
		merge,
		Empty,
		fail,
		stream,
		parseBody,
		parseCookies,
		parseParams,
		parseQuery,
	);
};
