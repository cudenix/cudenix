export interface SSE<Response> extends EventSource {
	onmessage: (event: MessageEvent<Response>) => any;
}

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
				listener.call(eventSource, {
					...event,
					data: JSON.parse(String(event.data)),
				});
			});
		},
	});

	return eventSource;
} as unknown as Constructor;

SSE.prototype = Object.create(EventSource.prototype);
SSE.prototype.constructor = SSE;

export const sse = <const Response>(
	url: string | URL,
	options?: EventSourceInit,
) => new SSE(url, options) as SSE<Response>;
