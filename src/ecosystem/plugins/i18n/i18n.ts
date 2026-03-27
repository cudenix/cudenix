import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { module } from "@/core/module";
import { getRequestContext } from "@/ecosystem/plugins/global-request-context/global-request-context";
import { Empty, FreezeEmpty } from "@/utils/objects/empty";

export type DeepPaths<Type extends Record<PropertyKey, unknown>> = {
	[Key in keyof Type]: Key extends string
		? Type[Key] extends Record<PropertyKey, unknown>
			? `${Key}` | `${Key}.${DeepPaths<Type[Key]>}`
			: `${Key}`
		: never;
}[keyof Type];

export type DeepValue<
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

export type ExtractPlaceholders<
	String extends string,
	Acc extends string = never,
> = String extends `${infer _Start}\${${infer Param}}${infer Rest}`
	? ExtractPlaceholders<Rest, Acc | Param>
	: Acc;

export interface Translation {
	[key: string]: string | Translation | (string | Translation)[];
}

export interface TranslateOptions<Translation> {
	language?: string;
	replace?: Translation extends string
		? {
				[Key in ExtractPlaceholders<Translation>]?: string;
			}
		: undefined;
}

export interface I18n {
	cookie?: string;
	header?: string;
	language: string;
	languages: string[];
	path: string;
	translations: Translation;
}

const store = new Empty() as unknown as I18n;

export const parseLanguageQuality = (
	entry: string,
	semiIdx: number,
): number => {
	const params = entry.slice(semiIdx + 1).split(";");

	for (let i = 0; i < params.length; i++) {
		const param = params[i]?.trim();

		if (!param) {
			continue;
		}

		if (
			param.length > 2 &&
			param.charCodeAt(0) === 0x71 &&
			param.charCodeAt(1) === 0x3d
		) {
			const q = Number(param.slice(2));

			if (!Number.isNaN(q)) {
				return q;
			}
		}
	}

	return 1;
};

export const selectLanguage = (header: string, languages: string[]) => {
	if (!header) {
		return;
	}

	let bestLang: string | undefined;
	let bestQ = -1;
	let bestOrder = Infinity;

	const entries = header.split(",");

	for (let order = 0; order < entries.length; order++) {
		const entry = entries[order]?.trim();

		if (!entry) {
			continue;
		}

		const semiIdx = entry.indexOf(";");
		const tag = (semiIdx === -1 ? entry : entry.slice(0, semiIdx))
			.trim()
			.toLowerCase();

		if (!tag) {
			continue;
		}

		const q = semiIdx === -1 ? 1 : parseLanguageQuality(entry, semiIdx);

		if (q <= 0) {
			continue;
		}

		if (q > bestQ || (q === bestQ && order < bestOrder)) {
			if (tag === "*") {
				bestLang = languages[0];
				bestQ = q;
				bestOrder = order;

				continue;
			}

			if (languages.indexOf(tag) !== -1) {
				bestLang = tag;
				bestQ = q;
				bestOrder = order;

				continue;
			}

			const dashIdx = tag.indexOf("-");

			if (dashIdx !== -1) {
				const prefix = tag.slice(0, dashIdx);

				if (languages.indexOf(prefix) !== -1) {
					bestLang = prefix;
					bestQ = q;
					bestOrder = order;
				}
			}
		}
	}

	return bestLang;
};

export const loadTranslations = async (directory: string) => {
	const result = new Empty() as Translation;

	const entries = await readdir(directory, {
		withFileTypes: true,
	});

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];

		if (!entry) {
			continue;
		}

		const fullPath = join(directory, entry.name);

		if (entry.isDirectory()) {
			result[entry.name] = await loadTranslations(fullPath);

			continue;
		}

		if (entry.isFile() && entry.name.endsWith(".json")) {
			const data = await Bun.file(fullPath).json();

			if (entry.name === "index.json") {
				Object.assign(result, data);

				continue;
			}

			result[entry.name.slice(0, -5)] = data;
		}
	}

	return result;
};

export const replace = <Translation extends string>(
	translation: Translation,
	replace: {
		[Key in ExtractPlaceholders<Translation>]?: string;
	},
) => {
	const keys = Object.keys(replace);

	let replaced = translation as string;

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];

		if (!key) {
			continue;
		}

		replaced = replaced.replaceAll(
			`\${${key}}`,
			replace[key as keyof typeof replace] ?? "",
		);
	}

	return replaced as Translation;
};

export const load = async (
	path: string,
	language: string,
	options?: Pick<I18n, "cookie" | "header"> & {
		types: boolean;
	},
) => {
	const directories = await readdir(path, {
		withFileTypes: true,
	});

	const languages = directories
		.filter((directory) => {
			return directory.isDirectory();
		})
		.map((directory) => {
			return directory.name;
		});

	store.cookie = options?.cookie;
	store.header = options?.header;
	store.language = language;
	store.languages = languages;
	store.path = path;
	store.translations = new Empty() as Translation;

	for (let i = 0; i < languages.length; i++) {
		const language = languages[i];

		if (!language) {
			continue;
		}

		store.translations[language] = await loadTranslations(
			join(path, language),
		);
	}

	if (options?.types !== false) {
		await Bun.write(
			join(path, "types.d.ts"),
			`namespace Cudenix.i18n { interface Translations ${JSON.stringify(store.translations[language])}; };`,
		);
	}
};

export const getLanguage = () => {
	return (
		(getRequestContext()?.store.i18n as Pick<I18n, "language"> | undefined)
			?.language ?? store.language
	);
};

export const translate = <
	const Path extends DeepPaths<Cudenix.i18n.Translations>,
>(
	path: Path,
	{
		language,
		replace,
	}: TranslateOptions<
		DeepValue<Cudenix.i18n.Translations, Path>
	> = FreezeEmpty,
): DeepValue<Cudenix.i18n.Translations, Path> => {
	const translations = store.translations[language ?? getLanguage()];

	if (!translations) {
		return path as DeepValue<Cudenix.i18n.Translations, Path>;
	}

	const split = path.split(".");

	let translation = translations as Translation[string];

	for (let i = 0; i < split.length; i++) {
		const key = split[i];

		if (!key) {
			continue;
		}

		const next = (translation as Translation)[key];

		if (next === undefined) {
			return path as DeepValue<Cudenix.i18n.Translations, Path>;
		}

		translation = next;
	}

	if (replace) {
		const keys = Object.keys(replace);

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];

			if (!key) {
				continue;
			}

			translation = (translation as string).replaceAll(
				`\${${key}}`,
				replace[key as keyof typeof replace] ?? "",
			);
		}
	}

	return translation as DeepValue<Cudenix.i18n.Translations, Path>;
};

export const i18n = () => {
	return module().middleware(
		({ request: { raw }, response: { cookies }, store: _store }, next) => {
			if (store.languages.length <= 1) {
				(_store as Record<"i18n", Pick<I18n, "language">>).i18n = {
					language: store.language,
				};

				return next();
			}

			const fromCookie = store.cookie
				? cookies.get(store.cookie)
				: undefined;

			(_store as Record<"i18n", Pick<I18n, "language">>).i18n = {
				language:
					(fromCookie && store.languages.indexOf(fromCookie) !== -1
						? fromCookie
						: undefined) ??
					selectLanguage(
						raw.headers.get(store.header ?? "accept-language") ??
							"",
						store.languages,
					) ??
					store.language,
			};

			return next();
		},
	);
};
