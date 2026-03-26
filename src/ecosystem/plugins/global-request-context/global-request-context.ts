import { AsyncLocalStorage } from "node:async_hooks";

import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";

export const asyncLocalStorage = new AsyncLocalStorage<AnyDeveloperContext>();

export const getRequestContext = () => {
	return asyncLocalStorage.getStore();
};

export const globalRequestContext = () => {
	return module().middleware(async (context, next) => {
		await asyncLocalStorage.run(context, next);
	});
};
