import { Empty } from "@/utils/objects/empty";

export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

	const pairs = header.split("; ");

	for (let i = 0; i < pairs.length; i++) {
		const pair = pairs[i];

		if (!pair) {
			continue;
		}

		const eq = pair.indexOf("=");

		if (eq === -1) {
			continue;
		}

		cookies[pair.substring(0, eq)] = pair.substring(eq + 1);
	}

	return cookies;
};
