import _cluster from "node:cluster";
import { cpus } from "node:os";

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
		for (let i = 0; i < cpus().length; i++) {
			_cluster.fork();
		}

		_cluster.on("exit", () => {
			if (sigint) {
				return;
			}

			_cluster.fork();
		});
	} else {
		await app();
	}

	return _cluster;
};
