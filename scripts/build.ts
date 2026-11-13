import path from "node:path";

import { $, Glob } from "bun";

import { exports } from "../package.json";

const ALIAS = /(?<prefix>from\s+|import\()"@\/(?<path>[^"]+)"/gu;
const EXTENSIONLESS =
	/(?<prefix>from\s+|import\()"(?<path>\.{1,2}\/[^"]+)(?<!\.js)"/gu;
const OUTDIR = "dist";

const entrypoints = Object.values(exports).flatMap((entry) =>
	typeof entry === "string"
		? []
		: [entry.import.replace("./dist/", "./src/").replace(/\.js$/u, ".ts")],
);

const rewrite = async (declaration: string): Promise<void> => {
	const file = Bun.file(path.join(OUTDIR, declaration));
	const source = await file.text();
	const root = path.relative(path.dirname(declaration), ".") || ".";
	const output = source
		.replaceAll(ALIAS, `$<prefix>"${root}/$<path>"`)
		.replaceAll(EXTENSIONLESS, `$<prefix>"$<path>.js"`);

	if (output === source) {
		return;
	}

	await Bun.write(file, output);
};

await $`rm -rf ${OUTDIR}`;

await Promise.all([
	Bun.build({
		entrypoints,
		outdir: OUTDIR,
		root: "src",
		sourcemap: "linked",
		splitting: true,
		target: "bun",
	}),

	$`bun x tsc --project tsconfig.build.json`,
]);

const declarations = await Array.fromAsync(new Glob("**/*.d.ts").scan(OUTDIR));

await Promise.all(
	declarations.map(async (declaration) => {
		await rewrite(declaration);
	}),
);
