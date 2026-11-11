import { decodePathParam } from "@/utils/urls/decode-path-param";

// a power of two, so "hash & (size - 1)" picks a slot
const NAME_CACHE_SIZE = 1024;
const NAME_CACHE_MAX_LENGTH = 64;

const nameCache = new Array<string>(NAME_CACHE_SIZE).fill("");

export const parseCookies = (header: string): Record<string, string> => {
	const cookies = Object.create(null) as Record<string, string>;

	if (!header) {
		return cookies;
	}

	const { length } = header;

	let percentIndex = header.indexOf("%");
	let start = 0;

	while (start < length) {
		let end = header.indexOf(";", start);

		if (end === -1) {
			end = length;
		}

		let nameStart = start;

		while (nameStart < end) {
			const charCode = header.charCodeAt(nameStart);

			if (charCode !== 32 && charCode !== 9) {
				break;
			}

			nameStart++;
		}

		let equalsIndex = nameStart;
		let hash = 0;

		while (equalsIndex < end) {
			const charCode = header.charCodeAt(equalsIndex);

			if (charCode === 61) {
				break;
			}

			hash = ((hash << 5) - hash + charCode) | 0;
			equalsIndex++;
		}

		if (equalsIndex < end) {
			let nameEnd = equalsIndex;

			while (nameEnd > nameStart) {
				const charCode = header.charCodeAt(nameEnd - 1);

				if (charCode !== 32 && charCode !== 9) {
					break;
				}

				nameEnd--;
			}

			if (nameEnd > nameStart) {
				let valueStart = equalsIndex + 1;
				let valueEnd = end;

				while (valueStart < valueEnd) {
					const charCode = header.charCodeAt(valueStart);

					if (charCode !== 32 && charCode !== 9) {
						break;
					}

					valueStart++;
				}

				while (valueEnd > valueStart) {
					const charCode = header.charCodeAt(valueEnd - 1);

					if (charCode !== 32 && charCode !== 9) {
						break;
					}

					valueEnd--;
				}

				const nameLength = nameEnd - nameStart;

				let name: string;

				if (nameLength === 1) {
					name = header[nameStart]!;
				} else {
					const slot = hash & (NAME_CACHE_SIZE - 1);

					name = nameCache[slot]!;

					if (
						name.length !== nameLength ||
						!header.startsWith(name, nameStart)
					) {
						name = header.slice(nameStart, nameEnd);

						if (nameLength <= NAME_CACHE_MAX_LENGTH) {
							nameCache[slot] = name;
						}
					}
				}

				if (percentIndex !== -1 && percentIndex < valueStart) {
					percentIndex = header.indexOf("%", valueStart);
				}

				cookies[name] ??=
					percentIndex !== -1 && percentIndex < valueEnd
						? decodePathParam(header.slice(valueStart, valueEnd))
						: header.slice(valueStart, valueEnd);
			}
		}

		start = end + 1;
	}

	return cookies;
};
