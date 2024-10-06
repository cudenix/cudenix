import _cluster from "node:cluster";
import { availableParallelism } from "node:os";

export const cluster = async (
	app: () => unknown | Promise<unknown>,
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

	await app();

	return _cluster;
};
