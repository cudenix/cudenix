import type { App } from "@/core/app";
import type { WSData } from "@/types/ws";

export const serve = (
	app: App,
	options?: Omit<Bun.Serve.Options<unknown>, "fetch" | "unix">,
) => {
	app.server = Bun.serve({
		development: false,
		reusePort: true,
		...options,
		fetch: (request) => {
			return app.fetch(request);
		},
		routes: app.routes,
		websocket: {
			close: (ws, code, reason) => {
				(ws.data as WSData)?.close?.(ws, code, reason);
			},
			drain: (ws) => {
				(ws.data as WSData)?.drain?.(ws);
			},
			message: (ws, message) => {
				(ws.data as WSData)?.message?.(ws, message);
			},
			open: (ws) => {
				(ws.data as WSData)?.open?.(ws);
			},
		},
	});

	process.once("beforeExit", () => {
		app.server?.stop(true);
		app.server = undefined;
	});

	Bun.gc();
};
