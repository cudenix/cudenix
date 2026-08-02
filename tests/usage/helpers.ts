import { Cudenix, type Plugin } from "@/core/cudenix";

/**
 * A live Cudenix app under test: its `Bun.Server` plus a bound `fetch`.
 */
export interface ServedApp extends Disposable {
	app: Cudenix;
	fetch(path: `/${string}`, init?: RequestInit): Promise<Response>;
	port: number;
	url(path: `/${string}`): string;
}

/**
 * Options accepted by {@link serveApp}.
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
 * Boot a real Bun server on an ephemeral port around a root module.
 *
 * @param module - Root module compiled into the app's routes.
 * @param options - Optional plugins and `Bun.serve` overrides.
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
