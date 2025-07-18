import type { AnyGeneratorSSE } from "@/types";

const startsWithOn = /^on/;

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

	const onmessageSetter = Object.getOwnPropertyDescriptor(
		EventSource.prototype,
		"onmessage",
	)?.set;

	if (!onmessageSetter) {
		throw new Error("EventSource does not have an onmessage setter");
	}

	Object.defineProperty(eventSource, "onmessage", {
		set(listener: (event: MessageEvent) => any) {
			onmessageSetter.call(eventSource, (event: MessageEvent) => {
				listener.call(
					eventSource,
					new MessageEvent(event.type, {
						...event,
						data: JSON.parse(String(event.data)),
						ports: [...event.ports],
					}),
				);
			});
		},
	});

	const handlerMap = new Map<string, (...args: any[]) => any>();

	return new Proxy(eventSource, {
		get(target, prop, receiver) {
			if (typeof prop !== "string" || !startsWithOn.test(prop)) {
				const value = Reflect.get(target, prop, receiver);

				if (typeof value === "function") {
					return value.bind(target);
				}

				return value;
			}

			return handlerMap.get(prop);
		},
		set(target, prop, value, receiver) {
			if (typeof prop !== "string" || !startsWithOn.test(prop)) {
				return Reflect.set(target, prop, value, receiver);
			}

			const eventName = prop.slice(2);

			if (handlerMap.has(prop)) {
				target.removeEventListener(eventName, handlerMap.get(prop)!);
			}

			const handler = (event: MessageEvent) => {
				value.call(target, {
					...event,
					data: JSON.parse(String(event.data)),
				});
			};

			handlerMap.set(prop, handler);

			target.addEventListener(eventName, handler);

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
