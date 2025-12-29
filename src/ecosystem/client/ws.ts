import { Empty } from "@/utils/objects/empty";

// @ts-expect-error
export interface WS<Request, Response> extends WebSocket {
	onmessage: (event: MessageEvent<Response>) => void;
	send: (data: Request) => void;
}

export type AnyWS = WS<any, any>;

type Constructor = new (url: string | URL) => AnyWS;

export const WS = function (this: AnyWS, url: string | URL) {
	const webSocket = new WebSocket(url);

	const onmessageSetter = Object.getOwnPropertyDescriptor(
		WebSocket.prototype,
		"onmessage",
	)?.set;

	if (!onmessageSetter) {
		throw new Error("WebSocket does not have an onmessage setter");
	}

	Object.defineProperty(webSocket, "onmessage", {
		set(listener: (event: MessageEvent) => any) {
			onmessageSetter.call(webSocket, (event: MessageEvent) => {
				listener.call(
					webSocket,
					new MessageEvent(event.type, {
						...event,
						data: JSON.parse(String(event.data)),
						ports: [...event.ports],
					}),
				);
			});
		},
	});

	const send = webSocket.send;

	Object.defineProperty(webSocket, "send", {
		value(data: any, options = new Empty()) {
			// @ts-expect-error
			send.call(webSocket, JSON.stringify(data), options);
		},
	});

	return webSocket;
} as unknown as Constructor;

WS.prototype = Object.create(WebSocket.prototype);
WS.prototype.constructor = WS;

export const ws = <const Request, const Response>(url: string | URL) => {
	return new WS(url) as WS<Request, Response>;
};
