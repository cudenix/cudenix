import { FreezeEmpty } from "@/utils/objects/empty";

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

	Object.defineProperty(webSocket, "onmessage", {
		set(listener: (event: MessageEvent) => any) {
			onmessageSetter?.call(webSocket, (event: MessageEvent) => {
				const parsed = Object.create(event);

				Object.defineProperty(parsed, "data", {
					value: JSON.parse(event.data),
				});

				listener.call(webSocket, parsed);
			});
		},
	});

	const send = webSocket.send;

	Object.defineProperty(webSocket, "send", {
		value(data: any, options = FreezeEmpty) {
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
