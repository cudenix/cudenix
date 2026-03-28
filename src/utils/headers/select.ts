import { parseQuality } from "@/utils/headers/quality";

export const selectHeader = (
	header: string,
	candidates: readonly string[],
	prefixMatch?: boolean,
): string | undefined => {
	if (!header) {
		return;
	}

	let best: string | undefined;
	let bestQ = -1;
	let bestOrder = Infinity;

	const entries = header.split(",");

	for (let order = 0; order < entries.length; order++) {
		const entry = entries[order]?.trim();

		if (!entry) {
			continue;
		}

		const semiIdx = entry.indexOf(";");
		const name = (semiIdx === -1 ? entry : entry.slice(0, semiIdx))
			.trim()
			.toLowerCase();

		if (!name) {
			continue;
		}

		const q = semiIdx === -1 ? 1 : parseQuality(entry, semiIdx);

		if (q <= 0) {
			continue;
		}

		if (q > bestQ || (q === bestQ && order < bestOrder)) {
			if (name === "*") {
				best = candidates[0];
				bestQ = q;
				bestOrder = order;

				continue;
			}

			if (candidates.indexOf(name) !== -1) {
				best = name;
				bestQ = q;
				bestOrder = order;

				continue;
			}

			if (prefixMatch) {
				const dashIdx = name.indexOf("-");

				if (dashIdx !== -1) {
					const prefix = name.slice(0, dashIdx);

					if (candidates.indexOf(prefix) !== -1) {
						best = prefix;
						bestQ = q;
						bestOrder = order;
					}
				}
			}
		}
	}

	return best;
};
