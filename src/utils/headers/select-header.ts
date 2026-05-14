import { FreezeEmpty } from "@/utils/objects/empty";

interface SelectHeaderOptions {
	prefixMatch?: boolean;
}

const findCandidateCi = (
	header: string,
	start: number,
	end: number,
	candidates: readonly string[],
) => {
	const length = end - start;

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];

		if (!candidate || candidate.length !== length) {
			continue;
		}

		let ok = true;

		for (let j = 0; j < length; j++) {
			let h = header.charCodeAt(start + j);

			if (h >= 65 && h <= 90) {
				h += 32;
			}

			if (h !== candidate.charCodeAt(j)) {
				ok = false;

				break;
			}
		}

		if (ok) {
			return candidate;
		}
	}
};

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

	let position = 0;

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

		const nameEnd = position;

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

					let qInt = 0;
					let qFrac = 0;
					let qDiv = 1;
					let qHasDigit = false;
					let qDecimal = false;
					let qInvalid = false;

					while (position < length) {
						const char = header.charCodeAt(position);

						if (char === 44 || char === 59 || char <= 32) {
							break;
						}

						if (char >= 48 && char <= 57) {
							if (qDecimal) {
								qFrac = qFrac * 10 + (char - 48);
								qDiv *= 10;
							} else {
								qInt = qInt * 10 + (char - 48);
							}

							qHasDigit = true;
						} else if (char === 46 && !qDecimal) {
							qDecimal = true;
						} else {
							qInvalid = true;

							break;
						}

						position++;
					}

					if (qHasDigit && !qInvalid) {
						q = qInt + qFrac / qDiv;
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

		if (nameEnd === nameStart || q <= 0) {
			continue;
		}

		if (q > bestQ) {
			if (
				nameEnd - nameStart === 1 &&
				header.charCodeAt(nameStart) === 42
			) {
				best = candidates[0];
				bestQ = q;
			} else {
				const matched = findCandidateCi(
					header,
					nameStart,
					nameEnd,
					candidates,
				);

				if (matched !== undefined) {
					best = matched;
					bestQ = q;
				} else if (prefixMatch) {
					let dashIdx = -1;

					for (let i = nameStart; i < nameEnd; i++) {
						if (header.charCodeAt(i) === 45) {
							dashIdx = i;

							break;
						}
					}

					if (dashIdx !== -1) {
						const prefixMatched = findCandidateCi(
							header,
							nameStart,
							dashIdx,
							candidates,
						);

						if (prefixMatched !== undefined) {
							best = prefixMatched;
							bestQ = q;
						}
					}
				}
			}
		}
	}

	return best;
};
