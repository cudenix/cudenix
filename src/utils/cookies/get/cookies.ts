import { Empty } from "@/utils/objects/empty";

export const getCookies = (headers: Request["headers"]) => {
	const cookies = new Empty() as Record<string, string>;

	const splittedCookies = headers.get("Cookie")?.split(";");

	for (let i = 0; i < (splittedCookies?.length ?? 0); i++) {
		const cookie = splittedCookies?.[i]?.trim();

		if (!cookie) {
			continue;
		}

		const [name, value] = cookie.split("=");

		if (!name || !value) {
			continue;
		}

		cookies[name] = value;
	}

	return cookies;
};
