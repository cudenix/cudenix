import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { module } from "@/core/module";
import { getRequestContext } from "@/ecosystem/plugins/global-request-context/global-request-context";
import { selectHeader } from "@/utils/headers/select";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

const STORE = new Empty() as unknown as I18n;

const PREFIX_MATCH_OPTIONS = Object.freeze({
	prefixMatch: true,
});

type DeepPaths<Type extends Record<PropertyKey, unknown>> = {
	[Key in keyof Type]: Key extends string
		? Type[Key] extends Record<PropertyKey, unknown>
			? `${Key}` | `${Key}.${DeepPaths<Type[Key]>}`
			: `${Key}`
		: never;
}[keyof Type];

type DeepValue<
	Type extends Record<PropertyKey, unknown>,
	Path extends string,
> = Path extends `${infer Key}.${infer Rest}`
	? Key extends keyof Type
		? Type[Key] extends Record<PropertyKey, unknown>
			? DeepValue<Type[Key], Rest>
			: never
		: never
	: Path extends keyof Type
		? Type[Path]
		: never;

type ExtractPlaceholders<
	String extends string,
	Acc extends string = never,
> = String extends `${infer _Start}\${${infer Param}}${infer Rest}`
	? ExtractPlaceholders<Rest, Acc | Param>
	: Acc;

interface Translation {
	[key: string]: string | Translation | (string | Translation)[];
}

interface TranslateOptions<Translation> {
	language?: string;
	replace?: Translation extends string
		? {
				[Key in ExtractPlaceholders<Translation>]?: string;
			}
		: undefined;
}

interface I18n {
	cookie?: string;
	header?: string;
	language: string;
	languages: string[];
	path: string;
	translations: Translation;
}

const loadTranslations = async (directory: string) => {
	const result = new Empty() as Translation;

	const entries = await readdir(directory, {
		withFileTypes: true,
	});

	const promises = [] as Promise<void>[];

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];

		if (!entry) {
			continue;
		}

		const fullPath = join(directory, entry.name);

		if (entry.isDirectory()) {
			promises.push(
				loadTranslations(fullPath).then((data) => {
					result[entry.name] = data;
				}),
			);

			continue;
		}

		if (entry.isFile() && entry.name.endsWith(".json")) {
			promises.push(
				Bun.file(fullPath)
					.json()
					.then((data) => {
						if (entry.name === "index.json") {
							Object.assign(result, data);

							return;
						}

						result[entry.name.slice(0, -5)] = data;
					}),
			);
		}
	}

	await Promise.all(promises);

	return result;
};

export const replace = <Translation extends string>(
	translation: Translation,
	replacements: {
		[Key in ExtractPlaceholders<Translation>]?: string;
	},
) => {
	const firstPlaceholder = translation.indexOf("${");

	if (firstPlaceholder === -1) {
		return translation;
	}

	const length = translation.length;

	let result =
		firstPlaceholder > 0 ? translation.substring(0, firstPlaceholder) : "";

	let i = firstPlaceholder;

	while (i < length) {
		if (
			translation.charCodeAt(i) === 24 &&
			i + 1 < length &&
			translation.charCodeAt(i + 1) === 0x7b
		) {
			const start = i + 2;
			const closingIdx = translation.indexOf("}", start);

			if (closingIdx !== -1 && closingIdx !== start) {
				const key = translation.substring(start, closingIdx);
				const value = replacements[key as keyof typeof replacements];

				if (value !== undefined) {
					result += value;

					i = closingIdx + 1;

					continue;
				}
			}

			result += translation[i];

			i++;
		} else {
			const nextDollar = translation.indexOf("${", i);

			if (nextDollar === -1) {
				result += translation.substring(i);

				break;
			}

			result += translation.substring(i, nextDollar);

			i = nextDollar;
		}
	}

	return result as Translation;
};

export const load = async (
	path: string,
	language: string,
	{
		cookie,
		header,
		types,
	}: Pick<I18n, "cookie" | "header"> & {
		types: boolean;
	} = FreezeEmpty as any,
) => {
	const directories = await readdir(path, {
		withFileTypes: true,
	});

	const languages = [] as string[];

	for (let i = 0; i < directories.length; i++) {
		const directory = directories[i];

		if (!directory?.isDirectory()) {
			continue;
		}

		languages.push(directory.name);
	}

	Object.assign(STORE, {
		cookie,
		header: header ?? "accept-language",
		language,
		languages,
		path,
		translations: new Empty() as Translation,
	});

	const promises = [] as Promise<void>[];

	for (let i = 0; i < languages.length; i++) {
		const language = languages[i];

		if (!language) {
			continue;
		}

		promises.push(
			loadTranslations(join(path, language)).then((translations) => {
				STORE.translations[language] = translations;
			}),
		);
	}

	await Promise.all(promises);

	if (types === false || !STORE.translations[language]) {
		return;
	}

	await Bun.write(
		join(path, "types.d.ts"),
		`namespace Cudenix.i18n { interface Translations ${JSON.stringify(STORE.translations[language])}; };`,
	);
};

export const getLanguage = () => {
	return (
		(getRequestContext()?.store.i18n as Partial<I18n>)?.language ??
		STORE.language
	);
};

export const translate = <
	const Path extends DeepPaths<Cudenix.i18n.Translations>,
>(
	path: Path,
	{
		language,
		replace: replacements,
	}: TranslateOptions<
		DeepValue<Cudenix.i18n.Translations, Path>
	> = FreezeEmpty,
) => {
	const translations = STORE.translations[language ?? getLanguage()];

	if (!translations) {
		return path as DeepValue<Cudenix.i18n.Translations, Path>;
	}

	const split = path.split(".");

	let translation = translations as Translation[string];

	for (let i = 0; i < split.length; i++) {
		const next = (translation as Translation)[split[i]!];

		if (next === undefined) {
			return path as DeepValue<Cudenix.i18n.Translations, Path>;
		}

		translation = next;
	}

	if (replacements && typeof translation === "string") {
		translation = replace(translation, replacements);
	}

	return translation as DeepValue<Cudenix.i18n.Translations, Path>;
};

export const i18n = () => {
	return module().middleware(
		({ request: { raw }, response: { cookies }, store }, next) => {
			(store as Record<"i18n", Partial<I18n>>).i18n = {
				language:
					STORE.languages.length <= 1
						? STORE.language
						: (selectHeader(
								(STORE.cookie
									? cookies.get(STORE.cookie)
									: undefined) ??
									raw.headers.get(STORE.header!) ??
									STORE.language,
								STORE.languages,
								PREFIX_MATCH_OPTIONS,
							) ?? STORE.language),
			};

			return next();
		},
	);
};
