import { Cudenix } from "@/core/cudenix";

/**
 * Build and compile an app around a root module, ready for `.fetch()`. Compile
 * is one-shot, so call this once per test rather than reusing an app.
 */
export const buildApp = (module: ConstructorParameters<typeof Cudenix>[0]) => {
	const app = new Cudenix(module);

	app.compile();

	return app;
};

/**
 * Build a `Request` with the absolute URL `.fetch()` requires (the per-method
 * matcher only matches `http(s)://host/...`).
 */
export const req = (path: `/${string}`, init?: RequestInit) =>
	new Request(`http://localhost${path}`, init);
