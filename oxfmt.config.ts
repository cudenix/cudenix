import { defineConfig } from "oxfmt";

export default defineConfig({
	arrowParens: "always",
	bracketSameLine: false,
	bracketSpacing: true,
	ignorePatterns: ["**/.gen", "**/*.gen.*", "**/.agents/**", "**/.claude/**"],
	objectWrap: "collapse",
	printWidth: 80,
	quoteProps: "as-needed",
	semi: true,
	singleQuote: false,
	sortImports: { newlinesBetween: true },
	sortPackageJson: true,
	tabWidth: 4,
	trailingComma: "all",
	useTabs: true,
});
