import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { App } from "@/app";
import { module as _module } from "@/module";
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
	const result = {} as Translation;
	const entries = await readdir(directory, {
		withFileTypes: true,
	});

	for (const entry of entries) {
		const fullPath = join(directory, entry.name);

		if (entry.isDirectory()) {
			result[entry.name] = await loadTranslations(fullPath);
		} else if (entry.isFile() && entry.name.endsWith(".json")) {
			const data = await Bun.file(fullPath).json();

			if (entry.name === "index.json") {
				Object.assign(result, data);
			} else {
				const key = entry.name.slice(0, -5);

				result[key] = data;
			}
		}
	}

	return result;
};

const addon = (path: string, language: string, options?: I18nAddonOptions) => {
	return async function (this: App) {
		const directories = await readdir(path, {
			withFileTypes: true,
		});
		const languages = directories
			.filter((directory) => directory.isDirectory())
			.map((directory) => directory.name);

		this.memory.set("i18n", {
			...options,
			language,
			languages,
			path,
			translations: new Empty() as Translation,
		});

		const i18n = this.memory.get("i18n") as I18n;

		for (let i = 0; i < languages.length; i++) {
			const lang = languages[i];

			i18n.translations[lang] = await loadTranslations(join(path, lang));
		}

		await Bun.write(
			join(path, "types.d.ts"),
			`namespace Cudenix.i18n { interface Translations ${JSON.stringify(
				i18n.translations[language],
			)}; };`,
		);

		return "i18n";
	};
};

const module = () => {
	return _module().middleware(
		(
			{
				memory,
				request: {
					raw: { headers },
				},
				store,
			},
			next,
		) => {
			const i18n = memory.get("i18n") as I18n | undefined;

			if (!i18n) {
				return next();
			}

			const language =
				getCookies(headers)[i18n.cookie ?? "Accept-Language"] ??
				headers.get(i18n.header ?? "Accept-Language");

			(store as Record<"i18n", Pick<I18n, "language">>).i18n = {
				language: i18n.languages.includes(language)
					? language
					: i18n.language,
			};

			return next();
		},
	);
};

const replace = <Translation extends string>(
	translation: Translation,
	replace: {
		[Key in ExtractPlaceholders<Translation>]?: string;
	},
): Translation => {
	const keys = Object.keys(replace);

	let replaced = translation as string;

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];

		// @ts-expect-error
		replaced = replaced.replaceAll(`\${${key}}`, replace[key]);
	}

	return replaced as Translation;
};

const translate = <const Path extends DeepPaths<Cudenix.i18n.Translations>>(
	path: Path,
	options?: TranslateOptions<DeepValue<Cudenix.i18n.Translations, Path>>,
): DeepValue<Cudenix.i18n.Translations, Path> => {
	const context = getRequestContext();

	const translations = (context?.memory.get("i18n") as I18n | undefined)
		?.translations[
		options?.language ??
			(context?.store as Record<"i18n", Pick<I18n, "language">>).i18n
				.language
	];

	if (!translations) {
		return path as DeepValue<Cudenix.i18n.Translations, Path>;
	}

	const split = path.split(".");

	let translation = translations as Translation[string];

	for (let i = 0; i < split.length; i++) {
		translation = (translation as Translation)[split[i]];
	}

	if (options?.replace) {
		const keys = Object.keys(options.replace);

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] as keyof NonNullable<typeof options>["replace"];

			translation = (translation as string).replaceAll(
				`\${${key}}`,
				options.replace[key],
			);
		}
	}

	return translation as DeepValue<Cudenix.i18n.Translations, Path>;
};

export const i18n = {
	addon,

	get language() {
		return (
			getRequestContext()?.store.i18n as
				| Pick<I18n, "language">
				| undefined
		)?.language;
	},

	module,

	replace,

	translate,
};
