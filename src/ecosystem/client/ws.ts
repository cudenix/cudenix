// @ts-expect-error
export interface WS<Request, Response> extends WebSocket {
	onmessage: (event: MessageEvent<Response>) => void;
	send: (data: Request) => void;
}

export type AnyWS = WS<any, any>;

type Constructor = new (url: string | URL) => AnyWS;

const onmessageSetter = Object.getOwnPropertyDescriptor(
	WebSocket.prototype,
	"onmessage",
)?.set;

export const WS = function (this: AnyWS, url: string | URL) {
	const webSocket = new WebSocket(url);

	let currentListener: ((event: MessageEvent) => any) | undefined;

	Object.defineProperty(webSocket, "onmessage", {
		get() {
			return currentListener;
		},
		set(listener: ((event: MessageEvent) => any) | undefined) {
			currentListener = listener;

			onmessageSetter?.call(
				webSocket,
				listener
					? (event: MessageEvent) => {
							const parsed = Object.create(event);

							Object.defineProperty(parsed, "data", {
								value: JSON.parse(event.data),
							});

							listener.call(webSocket, parsed);
						}
					: undefined,
			);
		},
	});

	const send = webSocket.send;

	Object.defineProperty(webSocket, "send", {
		value(data: any) {
			send.call(webSocket, JSON.stringify(data));
		},
	});

	return webSocket;
} as unknown as Constructor;

export const ws = <const Request, const Response>(url: string | URL) => {
	return new WS(url) as WS<Request, Response>;
};
