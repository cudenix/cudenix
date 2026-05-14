import { Empty } from "@/utils/objects/empty";

export const parseCookies = (header: string) => {
	const cookies = new Empty() as Record<string, string>;

	const parts = header.split("; ");

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];

		if (part === undefined) {
			continue;
		}

		const eq = part.indexOf("=");

		if (eq === -1) {
			continue;
		}

		cookies[part.substring(0, eq)] = part.substring(eq + 1);
	}

	return cookies;
};
