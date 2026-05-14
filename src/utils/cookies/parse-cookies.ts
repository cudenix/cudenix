import { Empty } from "@/utils/objects/empty";

export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

	const length = header.length;

	let start = 0;

	while (start < length) {
		const sep = header.indexOf("; ", start);
		const end = sep === -1 ? length : sep;

		const eq = header.indexOf("=", start);

		if (eq !== -1 && eq < end && eq > start) {
			cookies[header.substring(start, eq)] = header.substring(
				eq + 1,
				end,
			);
		}

		if (sep === -1) {
			break;
		}

		start = sep + 2;
	}

	return cookies;
};
