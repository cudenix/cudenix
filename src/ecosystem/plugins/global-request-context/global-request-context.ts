import { AsyncLocalStorage } from "node:async_hooks";

import type { AnyDeveloperContext } from "@/core/context";
import { module } from "@/core/module";

const ASYNC_LOCAL_STORAGE = new AsyncLocalStorage<AnyDeveloperContext>();

export const getRequestContext = () => ASYNC_LOCAL_STORAGE.getStore();

export const globalRequestContext = () =>
	module().middleware(async (context, next) => {
		await ASYNC_LOCAL_STORAGE.run(context, next);
	});
