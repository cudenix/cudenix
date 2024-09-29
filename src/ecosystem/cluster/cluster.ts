import _cluster from "node:cluster";
import { availableParallelism } from "node:os";

import type { App } from "@/app";

export const cluster = async (
	initialize: () => App | Promise<App>,
): Promise<typeof _cluster> => {
	let sigint = false;

	process.on("SIGINT", () => {
		sigint = true;

		const keys = Object.keys(_cluster.workers ?? {});

		for (let i = 0; i < keys.length; i++) {
			_cluster.workers?.[keys[i]]?.kill();
		}

		process.exit(0);
	});

	if (_cluster.isPrimary) {
		for (let i = 0; i < availableParallelism(); i++) {
			_cluster.fork();
		}

		_cluster.on("exit", () => {
			if (sigint) {
				return;
			}

			_cluster.fork();
		});

		return _cluster;
	}

	const app = await initialize();

	app.memory.set("cluster", {
		id: _cluster.worker?.id,
		pid: _cluster.worker?.process.pid,
	});

	return _cluster;
};
