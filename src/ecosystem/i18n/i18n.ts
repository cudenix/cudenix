import { readFileSync, readdirSync, watch, writeFileSync } from "node:fs";

import type { App } from "@/app";
import type { Context } from "@/context";
import { getRequestContext } from "@/storage";
import { Empty } from "@/utils/empty";
import { getCookies } from "@/utils/get-cookies";
import type { I18nTranslations } from "@cudenix/cudenix/i18n";

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

interface I18nAddonOptions extends Pick<I18n, "cookie" | "header"> {
	watch?: boolean;
}

const loadTranslation = (path: string, language: string) => {
	return JSON.parse(
		readFileSync(`${path}/${language}/${language}.json`, "utf8"),
	) as Translation;
};

const writeTypes = (path: string, translations: Translation) => {
	writeFileSync(
		`${path}/types.d.ts`,
		`import '@cudenix/cudenix/i18n'; declare module '@cudenix/cudenix/i18n' { export interface I18nTranslations ${JSON.stringify(translations)}; };`,
	);
};

const watchChanges = (memory: App["memory"], path: string) => {
	const event = watch(
		path,
		{
			recursive: true,
		},
		(event, filename) => {
			if (event !== "change" || !filename) {
				return;
			}

			const language = filename.split("/").pop()?.split(".")[0];

			if (
				!language ||
				(memory.get("i18n") as I18n).languages.indexOf(language) === -1
			) {
				return;
			}

			const translation = loadTranslation(
				(memory.get("i18n") as I18n).path,
				language,
			);

			if (
				Bun.deepEquals(
					(memory.get("i18n") as I18n).translations[language],
					translation,
				)
			) {
				return;
			}

			(memory.get("i18n") as I18n).translations[language] = translation;

			if (language === (memory.get("i18n") as I18n).language) {
				writeTypes((memory.get("i18n") as I18n).path, translation);
			}
		},
	);

	process.on("SIGINT", () => {
		event.removeAllListeners();
		event.close();

		process.exit(0);
	});
};

export function i18nAddon(
	path: string,
	language: string,
	options?: I18nAddonOptions,
) {
	return function (this: App) {
		const languages = readdirSync(path, {
			withFileTypes: true,
		})
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
				loadTranslation(path, languages[i]);
		}

		writeTypes(
			path,
			(this.memory.get("i18n") as I18n).translations[language] as Translation,
		);

		if (options?.watch) {
			watchChanges(this.memory, path);
		}

		return "i18n";
	};
}

export const i18nModule = async () => {
	const module = (await import("@/module")).module;

	return module().middleware((context, next) => {
		const i18n = (context as Context).memory.get("i18n") as I18n | undefined;

		if (!i18n) {
			return next();
		}

		const acceptLanguage =
			getCookies(context.request.raw.headers)["Accept-Language"] ??
			context.request.raw.headers.get("Accept-Language");
		const language = i18n.languages.includes(acceptLanguage)
			? acceptLanguage
			: i18n.language;

		(context.store as Record<"i18n", Pick<I18n, "language">>).i18n = {
			language,
		};

		return next();
	});
};

export const i18n = {
	get language() {
		return (getRequestContext()?.store.i18n as I18n | undefined)?.language;
	},
	get translate() {
		const context = getRequestContext();

		return (context?.memory.get("i18n") as I18n | undefined)?.translations[
			(context?.store as Record<"i18n", Pick<I18n, "language">>).i18n.language
		] as I18nTranslations;
	},
};
