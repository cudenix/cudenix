import { readdir } from "node:fs/promises";
import { module } from "@/module";

import type { App } from "@/app";
import { getRequestContext } from "@/storage";
import { Empty } from "@/utils/empty";
import { getCookies } from "@/utils/get-cookies";

type ExtractPlaceholders<String extends string> =
	String extends `${infer _Start}\${${infer Param}}${infer Rest}`
		? Param | ExtractPlaceholders<Rest>
		: never;

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

interface I18nAddonOptions extends Pick<I18n, "cookie" | "header"> {}

export const i18n = {
	addon(path: string, language: string, options?: I18nAddonOptions) {
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
	},

	get language() {
		return (
			getRequestContext()?.store.i18n as
				| Pick<I18n, "language">
				| undefined
		)?.language;
	},

	module() {
		return module().middleware(
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
	},

	translate<String extends keyof Cudenix.i18n.Translations>(
		text: String,
		options?: {
			language?: string;
			repalce?: {
				[Key in ExtractPlaceholders<String>]?: string;
			};
		},
	): Cudenix.i18n.Translations[String] {
		const context = getRequestContext();

		const translations = (context?.memory.get("i18n") as I18n | undefined)
			?.translations[
			options?.language ??
				(context?.store as Record<"i18n", Pick<I18n, "language">>).i18n
					.language
		];

		if (!translations) {
			return text;
		}

		let translation = translations[text] as string;

		if (options?.repalce) {
			const keys = Object.keys(options.repalce);

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i] as keyof NonNullable<
					typeof options
				>["repalce"];

				translation = translation.replaceAll(
					`$\{${key}}`,
					options.repalce[key],
				);
			}
		}

		return translation;
	},
};
