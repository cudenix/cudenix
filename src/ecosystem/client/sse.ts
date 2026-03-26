import type { AnyGeneratorSSE } from "@/types/generator-sse";

export type SSE<Generator extends AnyGeneratorSSE> = Omit<
	EventSource,
	"onmessage"
> & {
	[Event in Exclude<
		Generator["event"],
		"message" | undefined
	> as `on${string & Event}`]: (
		event: MessageEvent<
			Extract<Generator, { data: any; event: Event }>["data"]
		>,
	) => any;
} & {
	onmessage: (
		event: MessageEvent<
			Extract<
				Generator,
				{ data: any; event?: "message" | undefined }
			>["data"]
		>,
	) => any;
};

export type AnySSE = SSE<any>;

type Constructor = new (url: string | URL, options?: EventSourceInit) => AnySSE;

export const SSE = function (
	this: AnySSE,
	url: string | URL,
	options?: EventSourceInit,
) {
	const eventSource = new EventSource(url, options);
	const listenerMap = new Map<string, (...args: any[]) => any>();
	const wrapperMap = new Map<string, (...args: any[]) => any>();

	return new Proxy(eventSource, {
		get(target, prop, receiver) {
			if (typeof prop !== "string" || !prop.startsWith("on")) {
				const value = Reflect.get(target, prop, receiver);

				if (typeof value === "function") {
					return value.bind(target);
				}

				return value;
			}

			return listenerMap.get(prop);
		},
		set(target, prop, value, receiver) {
			if (typeof prop !== "string" || !prop.startsWith("on")) {
				return Reflect.set(target, prop, value, receiver);
			}

			const eventName = prop.slice(2);

			if (wrapperMap.has(prop)) {
				target.removeEventListener(eventName, wrapperMap.get(prop)!);
			}

			listenerMap.set(prop, value);

			const wrapper = (event: MessageEvent) => {
				const parsed = Object.create(event);

				Object.defineProperty(parsed, "data", {
					value: JSON.parse(event.data),
				});

				value.call(target, parsed);
			};

			wrapperMap.set(prop, wrapper);

			target.addEventListener(eventName, wrapper);

			return true;
		},
	});
} as unknown as Constructor;

SSE.prototype = Object.create(EventSource.prototype);
SSE.prototype.constructor = SSE;

export const sse = <const Generator extends AnyGeneratorSSE>(
	url: string | URL,
	options?: EventSourceInit,
) => {
	return new SSE(url, options) as SSE<Generator>;
};
