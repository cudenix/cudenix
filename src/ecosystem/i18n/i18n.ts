import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { App } from "@/app";
import { module } from "@/module";
import { getRequestContext } from "@/storage";
import { Empty } from "@/utils/empty";
import { getCookies } from "@/utils/get-cookies";

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

type ExtractPlaceholders<String extends string> =
	String extends `${infer _Start}\${${infer Param}}${infer Rest}`
		? Param | ExtractPlaceholders<Rest>
		: never;

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
	path: string;
	cookie?: string;
	header?: string;
	language: string;
	languages: string[];
	translations: Translation;
}

type I18nAddonOptions = Pick<I18n, "cookie" | "header">;

const loadTranslations = async (directory: string) => {
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

export const i18n = {
	addon: (path: string, language: string, options?: I18nAddonOptions) => {
		return async function (this: App) {
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

			i18n.store = {
				...options,
				language,
				languages,
				path,
				translations: new Empty() as Translation,
			};

			for (let i = 0; i < languages.length; i++) {
				const language = languages[i];

				if (!language) {
					continue;
				}

				i18n.store.translations[language] = await loadTranslations(
					join(path, language),
				);
			}

			await Bun.write(
				join(path, "types.d.ts"),
				`namespace Cudenix.i18n { interface Translations ${JSON.stringify(i18n.store.translations[language])}; };`,
			);

			return "i18n";
		};
	},

	get language() {
		return (
			(
				getRequestContext()?.store.i18n as
					| Pick<I18n, "language">
					| undefined
			)?.language ?? i18n.store.language
		);
	},

	module: () => {
		return module().middleware(({ request: { raw }, store }, next) => {
			const language =
				getCookies(raw.headers)[
					i18n.store.cookie ?? "Accept-Language"
				] ??
				raw.headers.get(i18n.store.header ?? "Accept-Language") ??
				i18n.language;

			(store as Record<"i18n", Pick<I18n, "language">>).i18n = {
				language:
					i18n.store.languages.indexOf(language) !== -1
						? language
						: i18n.language,
			};

			return next();
		});
	},

	replace: <Translation extends string>(
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
	},

	store: new Empty() as unknown as I18n,

	translate: <const Path extends DeepPaths<Cudenix.i18n.Translations>>(
		path: Path,
		{
			language,
			replace,
		}: TranslateOptions<
			DeepValue<Cudenix.i18n.Translations, Path>
		> = new Empty(),
	): DeepValue<Cudenix.i18n.Translations, Path> => {
		const translations = i18n.store.translations[language ?? i18n.language];

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

			translation = (translation as Translation)[key] ?? "";
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
	},
};
