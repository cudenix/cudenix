import { AsyncLocalStorage } from "node:async_hooks";

import type { AnyContext } from "@/core/context";
import { Module } from "@/core/module";
import { peekStatus } from "@/utils/promises/peek";

const ASYNC_LOCAL_STORAGE = new AsyncLocalStorage<AnyContext>();

export const getRequestContext = () => ASYNC_LOCAL_STORAGE.getStore();

export const globalRequestContext = () =>
	new Module().middleware(async (context, next) => {
		const returned = ASYNC_LOCAL_STORAGE.run(context, next);

		// a chain that never suspends settles before it is read
		if (peekStatus(returned) !== "fulfilled") {
			await returned;
		}
	});
