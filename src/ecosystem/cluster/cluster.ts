export const cluster = (command: string) => {
	if (process.env.WORKER_ID || process.argv.indexOf("--worker") !== -1) {
		return;
	}

	const cpus = navigator.hardwareConcurrency;
	const buns = new Array(cpus);

	for (let i = 0; i < cpus; i++) {
		buns[i] = Bun.spawn({
			cmd: [...command.split(" "), "--worker"],
			env: {
				...process.env,
				WORKER_ID: (i + 1).toString(),
			},
			stderr: "inherit",
			stdin: "inherit",
			stdout: "inherit",
		});
	}

	const kill = () => {
		for (let i = 0; i < cpus; i++) {
			try {
				buns[i].kill();
			} catch {}
		}
	};

	process.on("SIGINT", kill);

	process.on("exit", kill);
};
