import { Empty } from "@/utils/objects/empty";

export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

	const length = header.length;

	let i = 0;

	while (i < length) {
		const eq = header.indexOf("=", i);

		if (eq === -1) {
			break;
		}

		let semi = header.indexOf(";", eq + 1);

		if (semi === -1) {
			semi = length;
		}

		cookies[header.substring(i, eq)] = header.substring(eq + 1, semi);

		i = semi + 2;
	}

	return cookies;
};
