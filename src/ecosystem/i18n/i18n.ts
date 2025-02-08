import { readdir } from "node:fs/promises";
import { module as _module } from "@/module";

import type { App } from "@/app";
import { getRequestContext } from "@/storage";
import { Empty } from "@/utils/empty";
import { getCookies } from "@/utils/get-cookies";

type DeepPaths<Type extends Record<PropertyKey, unknown>> = {
	[Key in keyof Type]: Key extends string
		? Type[Key] extends Record<PropertyKey, unknown>
			? [Key] | [Key, ...DeepPaths<Type[Key]>]
			: [Key]
		: never;
}[keyof Type];

type DeepValue<
	Type extends Record<PropertyKey, unknown>,
	Path extends string[],
> = Path extends [infer Key, ...infer Rest]
	? Key extends keyof Type
		? Rest extends [string, ...string[]]
			? Type[Key] extends Record<PropertyKey, unknown>
				? DeepValue<Type[Key], Rest>
				: never
			: Type[Key]
		: never
	: never;

type ExtractPlaceholders<String extends string> =
	String extends `${infer _Start}\${${infer Param}}${infer Rest}`
		? Param | ExtractPlaceholders<Rest>
		: never;

interface TranslateOptions<Key extends string> {
	language?: string;
	replace?: {
		[_Key in ExtractPlaceholders<Key>]?: string;
	};
}

interface Translation {
	[key: string]: string | Translation | (string | Translation)[];
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
			path,
			languages,
			translations: new Empty() as Translation,
		});

		for (let i = 0; i < languages.length; i++) {
			(this.memory.get("i18n") as I18n).translations[languages[i]] =
				await Bun.file(
					`${path}/${languages[i]}/${languages[i]}.json`,
				).json();
		}

		await Bun.write(
			`${path}/types.d.ts`,
			`namespace Cudenix.i18n { interface Translations ${JSON.stringify((this.memory.get("i18n") as I18n).translations[language])}; };`,
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

function translate<const Path extends DeepPaths<Cudenix.i18n.Translations>>(
	...path: Path
): DeepValue<Cudenix.i18n.Translations, Path>;

function translate<const Path extends DeepPaths<Cudenix.i18n.Translations>>(
	...args: [
		...path: Path,
		options: TranslateOptions<DeepValue<Cudenix.i18n.Translations, Path>>,
	]
): DeepValue<Cudenix.i18n.Translations, Path>;

function translate(...args: any[]): any {
	let options: TranslateOptions<string> | undefined;
	let path: string[];

	if (
		args.length > 0 &&
		typeof args[args.length - 1] === "object" &&
		args[args.length - 1] !== null &&
		!Array.isArray(args[args.length - 1])
	) {
		options = args.pop();

		path = args;
	} else {
		path = args;
	}

	const context = getRequestContext();

	const translations = (context?.memory.get("i18n") as I18n | undefined)
		?.translations[
		options?.language ??
			(context?.store as Record<"i18n", Pick<I18n, "language">>).i18n
				.language
	];

	if (!translations) {
		return path.join(".");
	}

	let translation = translations as Translation[string];

	for (let i = 0; i < path.length; i++) {
		translation = (translation as Translation)[path[i]];
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

	return translation;
}

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

	translate,
};
