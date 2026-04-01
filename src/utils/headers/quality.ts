export const parseQuality = (entry: string, semiIdx: number) => {
	const params = entry.slice(semiIdx + 1).split(";");

	for (let i = 0; i < params.length; i++) {
		const param = params[i]?.trim();

		if (!param) {
			continue;
		}

		if (
			param.length > 2 &&
			param.charCodeAt(0) === 0x71 &&
			param.charCodeAt(1) === 0x3d
		) {
			const q = Number(param.slice(2));

			if (!Number.isNaN(q)) {
				return q;
			}
		}
	}

	return 1;
};
