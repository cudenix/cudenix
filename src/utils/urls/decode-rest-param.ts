import { decodePathParam } from "@/utils/urls/decode-path-param";

export const decodeRestParam = (value: string): string[] =>
	value.includes("/")
		? // oxlint-disable-next-line unicorn/no-array-callback-reference -- An arrow wrapper measured slower on segments without escapes
			value.split("/").map(decodePathParam)
		: [decodePathParam(value)];
