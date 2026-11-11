import { HEX_VALUES } from "@/utils/urls/hex-values";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

const decodeQueryComponent = (component: string): string => {
	const input = encoder.encode(component);
	const { length } = input;
	const output = new Uint8Array(length);

	let written = 0;

	for (let i = 0; i < length; i++) {
		const byte = input[i]!;

		if (byte === 37 && i + 2 < length) {
			const highNibble = HEX_VALUES[input[i + 1]!]!;
			const lowNibble = HEX_VALUES[input[i + 2]!]!;

			if (highNibble !== -1 && lowNibble !== -1) {
				output[written++] = highNibble * 16 + lowNibble;
				i += 2;

				continue;
			}
		}

		output[written++] = byte;
	}

	return decoder.decode(output.subarray(0, written));
};

const replacePlus = (component: string): string => {
	const { length } = component;

	let output = "";
	let last = 0;

	for (let i = 0; i < length; i++) {
		if (component.charCodeAt(i) === 43) {
			output += `${component.slice(last, i)} `;
			last = i + 1;
		}
	}

	return last === 0 ? component : output + component.slice(last);
};

export const parseQuery = (url: string): Record<string, unknown> => {
	const params = Object.create(null) as Record<string, unknown>;
	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return params;
	}

	const hashIndex = url.indexOf("#");

	let urlLength = url.length;

	if (hashIndex !== -1) {
		if (hashIndex < queryIndex) {
			return params;
		}

		urlLength = hashIndex;
	}

	let multiValueKeys: string[] | undefined;
	let i = queryIndex + 1;

	while (i < urlLength) {
		const keyStart = i;

		let keyHasPlus = false;
		let keyHasPercent = false;
		let valueHasPlus = false;
		let valueHasPercent = false;

		while (i < urlLength) {
			const charCode = url.charCodeAt(i);

			if (charCode === 61 || charCode === 38) {
				break;
			}

			if (charCode === 43) {
				keyHasPlus = true;
			} else if (charCode === 37) {
				keyHasPercent = true;
			}

			i++;
		}

		const hasValue = i < urlLength && url.charCodeAt(i) === 61;

		let key = url.slice(keyStart, i);
		let value: string;
		let firstCharCode = -1;

		if (hasValue) {
			i++;

			const valueStart = i;

			if (i < urlLength) {
				firstCharCode = url.charCodeAt(i);
			}

			while (i < urlLength) {
				const charCode = url.charCodeAt(i);

				if (charCode === 38) {
					break;
				}

				if (charCode === 43) {
					valueHasPlus = true;
				} else if (charCode === 37) {
					valueHasPercent = true;
				}

				i++;
			}

			value = url.slice(valueStart, i);
		} else {
			value = "";
		}

		if (key.length > 0) {
			if (keyHasPlus) {
				key = replacePlus(key);
			}

			if (keyHasPercent) {
				try {
					key = decodeURIComponent(key);
				} catch {
					key = decodeQueryComponent(key);
				}
			}

			let parsed = value as unknown;

			if (hasValue) {
				if (valueHasPlus) {
					value = replacePlus(value);
					parsed = value;
				}

				if (valueHasPercent) {
					try {
						value = decodeURIComponent(value);
					} catch {
						value = decodeQueryComponent(value);
					}

					parsed = value;
					firstCharCode = value.charCodeAt(0);
				}

				if (firstCharCode === 123 || firstCharCode === 91) {
					const lastCharCode = value.charCodeAt(value.length - 1);

					if (
						(firstCharCode === 123 && lastCharCode === 125) ||
						(firstCharCode === 91 && lastCharCode === 93)
					) {
						try {
							parsed = JSON.parse(value);
						} catch {
							parsed = value;
						}
					}
				}
			}

			if (params[key] === undefined) {
				params[key] = parsed;
			} else if (multiValueKeys?.includes(key) === true) {
				(params[key] as unknown[]).push(parsed);
			} else {
				multiValueKeys ??= [];
				multiValueKeys.push(key);

				params[key] = [params[key], parsed];
			}
		}

		if (i >= urlLength) {
			break;
		}

		i++;
	}

	return params;
};
