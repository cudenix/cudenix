import { FreezeEmpty } from "@/utils/objects/empty";

interface SelectHeaderOptions {
	prefixMatch?: boolean;
}

export const selectHeader = (
	header: string,
	candidates: readonly string[],
	{ prefixMatch }: SelectHeaderOptions = FreezeEmpty,
) => {
	if (!header) {
		return;
	}

	const length = header.length;

	let best: string | undefined;
	let bestQ = -1;
	let bestOrder = Infinity;

	let position = 0;
	let order = 0;

	while (position < length) {
		while (position < length && header.charCodeAt(position) <= 32) {
			position++;
		}

		if (position >= length) {
			break;
		}

		const nameStart = position;

		while (position < length) {
			const char = header.charCodeAt(position);

			if (char === 44 || char === 59 || char <= 32) {
				break;
			}

			position++;
		}

		const rawName = header.substring(nameStart, position);

		while (position < length && header.charCodeAt(position) <= 32) {
			position++;
		}

		let q = 1;

		if (position < length && header.charCodeAt(position) === 59) {
			position++;

			while (position < length && header.charCodeAt(position) !== 44) {
				while (position < length && header.charCodeAt(position) <= 32) {
					position++;
				}

				if (
					position + 1 < length &&
					header.charCodeAt(position) === 113 &&
					header.charCodeAt(position + 1) === 61
				) {
					position += 2;

					const qStart = position;

					while (position < length) {
						const char = header.charCodeAt(position);

						if (char === 44 || char === 59 || char <= 32) {
							break;
						}

						position++;
					}

					if (qStart < position) {
						const parsed = +header.substring(qStart, position);

						if (!Number.isNaN(parsed)) {
							q = parsed;
						}
					}

					break;
				}

				if (position < length && header.charCodeAt(position) !== 44) {
					position++;
				}
			}

			while (position < length && header.charCodeAt(position) !== 44) {
				position++;
			}
		}

		if (position < length && header.charCodeAt(position) === 44) {
			position++;
		}

		if (!rawName || q <= 0) {
			order++;

			continue;
		}

		if (q > bestQ || (q === bestQ && order < bestOrder)) {
			const name = rawName.toLowerCase();

			if (name === "*") {
				best = candidates[0];
				bestQ = q;
				bestOrder = order;
			} else if (candidates.indexOf(name) !== -1) {
				best = name;
				bestQ = q;
				bestOrder = order;
			} else if (prefixMatch) {
				const dashIdx = name.indexOf("-");

				if (dashIdx !== -1) {
					const prefix = name.substring(0, dashIdx);

					if (candidates.indexOf(prefix) !== -1) {
						best = prefix;
						bestQ = q;
						bestOrder = order;
					}
				}
			}
		}

		order++;
	}

	return best;
};
