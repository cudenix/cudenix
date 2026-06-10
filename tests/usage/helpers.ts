import { Cudenix, type Plugin } from "@/core/cudenix";

/**
 * A live Cudenix app under test: its `Bun.Server` plus a `fetch` already bound
 * to the server's address. Implements `Disposable`, so a `using` binding stops
 * the server when the test block exits — including on failure.
 */
export interface ServedApp extends Disposable {
	app: Cudenix;
	fetch(path: `/${string}`, init?: RequestInit): Promise<Response>;
	port: number;
	url(path: `/${string}`): string;
}

/**
 * Options accepted by {@link serveApp}. `listen` carries extra `Bun.serve`
 * options forwarded to `.listen()` — `port` is always overridden to `0` — and
 * `plugins` lists setup hooks registered before the server boots.
 *
 * @example
 * ```typescript
 * const a: ServeAppOptions = {
 *   listen: { error: () => new Response(undefined, { status: 500 }) },
 *   plugins: [somePlugin()],
 * };
 * ```
 */
export interface ServeAppOptions {
	listen?: Parameters<Cudenix["listen"]>[0];
	plugins?: Plugin[];
}

/**
 * Boot a real Bun server around a root module and return a handle whose
 * `fetch` targets it, so a test drives the app end-to-end through Bun's own
 * router — both the static route table and the regexp fallback — exactly as a
 * deployed app is reached, rather than the in-process `app.fetch()` shortcut
 * that only ever consults the regexp table.
 *
 * Listens on an ephemeral port (`port: 0`); compile is one-shot, so build one
 * server per test. Bind it with `using` to stop the server automatically.
 *
 * @param module - Root module compiled into the app's routes.
 * @param options - Optional plugins and `Bun.serve` overrides; see
 *   {@link ServeAppOptions}.
 * @returns A {@link ServedApp} handle bound to the running server.
 * @example
 * ```typescript
 * using server = serveApp(new Module().route("GET", "/a", () => ok("v1")));
 *
 * const result = await server.fetch("/a");
 *
 * result.status; // 200
 * ```
 */
export const serveApp = (
	module: ConstructorParameters<typeof Cudenix>[0],
	options?: ServeAppOptions,
): ServedApp => {
	const app = new Cudenix(module);

	if (options?.plugins) {
		app.plugins(options.plugins);
	}

	app.listen({ ...options?.listen, port: 0 });

	const port = app.server!.port!;

	return {
		app,
		fetch: (path, init) => fetch(`http://localhost:${port}${path}`, init),
		port,
		url: (path) => `http://localhost:${port}${path}`,
		[Symbol.dispose]() {
			app.server?.stop(true);
		},
	};
};
