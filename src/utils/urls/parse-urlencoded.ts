import { HEX_VALUES } from "@/utils/urls/hex-values";

const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

const encoder = new TextEncoder();

const decodeBytes = (component: string): string => {
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

	return output + component.slice(last);
};

export const parseUrlencoded = (
	text: string,
	start: number,
	end: number,
	isQuery: boolean,
): Record<string, unknown> => {
	const params: Record<string, unknown> = {};

	let multiValueKeys: string[] | undefined;
	let i = start;

	while (i < end) {
		const keyStart = i;

		let keyHasPlus = false;
		let keyHasPercent = false;
		let valueHasPlus = false;
		let valueHasPercent = false;

		while (i < end) {
			const charCode = text.charCodeAt(i);

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

		const hasValue = i < end && text.charCodeAt(i) === 61;

		let key = text.slice(keyStart, i);
		let value = "";
		let firstCharCode = -1;

		if (hasValue) {
			const valueStart = ++i;

			if (isQuery && i < end) {
				firstCharCode = text.charCodeAt(i);
			}

			while (i < end) {
				const charCode = text.charCodeAt(i);

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

			value = text.slice(valueStart, i);
		}

		// a query drops empty keys, a form keeps "=value"
		if (key.length > 0 || (hasValue && !isQuery)) {
			if (keyHasPlus) {
				key = replacePlus(key);
			}

			if (keyHasPercent) {
				try {
					key = decodeURIComponent(key);
				} catch {
					key = decodeBytes(key);
				}
			}

			if (valueHasPlus) {
				value = replacePlus(value);
			}

			if (valueHasPercent) {
				try {
					value = decodeURIComponent(value);
				} catch {
					value = decodeBytes(value);
				}

				if (isQuery) {
					firstCharCode = value.charCodeAt(0);
				}
			}

			let parsed: unknown = value;

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

			const current = params[key];

			if (current === undefined) {
				params[key] = parsed;
			} else if (multiValueKeys?.includes(key) === true) {
				(current as unknown[]).push(parsed);
			} else {
				multiValueKeys ??= [];
				multiValueKeys.push(key);

				params[key] = [current, parsed];
			}
		}

		i++;
	}

	return params;
};
