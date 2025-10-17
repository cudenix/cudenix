export const cluster = (command: string) => {
	if (process.argv.indexOf("--worker") !== -1) {
		return;
	}

	const cpus = navigator.hardwareConcurrency;
	const buns = new Array(cpus);

	for (let i = 0; i < cpus; i++) {
		buns[i] = Bun.spawn({
			cmd: [...command.split(" "), "--worker"],
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

	process.once("SIGINT", kill);

	process.once("exit", kill);
};
