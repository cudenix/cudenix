export const cluster = (command: string) => {
	if (process.argv.indexOf("--worker") !== -1) {
		return;
	}

	const cpus = navigator.hardwareConcurrency;
	const cmd = [...command.split(" "), "--worker"];
	const buns = Array.from({ length: cpus }) as Bun.Subprocess<
		"inherit",
		"inherit",
		"inherit"
	>[];

	for (let i = 0; i < cpus; i++) {
		buns[i] = Bun.spawn({
			cmd,
			stderr: "inherit",
			stdin: "inherit",
			stdout: "inherit",
		});
	}

	const kill = () => {
		for (let i = 0; i < cpus; i++) {
			try {
				buns[i]?.kill();
			} catch {}
		}
	};

	process.once("SIGINT", kill);

	process.once("SIGTERM", kill);
};
